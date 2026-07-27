import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Conexão com o seu banco
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const apiKey = process.env.API_SPORTS_KEY;
    if (!apiKey) throw new Error('Chave não encontrada');

    // Busca os jogos na gringa
    const resposta = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
      method: 'GET',
      headers: { 'x-apisports-key': apiKey, 'Content-Type': 'application/json' }
    });
    
    if (!resposta.ok) {
       throw new Error(`Falha de rede da API externa: ${resposta.status}`);
    }

    const dados = await resposta.json();
    const jogosAoVivo = dados.response || []; // Previne erro caso a resposta venha vazia

    // =========================================================================
    // O SEU DICIONÁRIO (DE / PARA) - VERSÃO DE TESTE
    // =========================================================================
    const dicionarioTimes: Record<number, number> = {
      1942: 1, // TRUQUE: Sacachispas (API) -> Fingindo ser Flamengo
      121: 2,  // Palmeiras
      126: 3,  // São Paulo
    };

    let jogosAtualizados = 0;

    for (const jogo of jogosAoVivo) {
      // Proteção extra contra dados nulos da API
      if (!jogo.teams || !jogo.teams.home || !jogo.teams.away) continue;

      const idMandanteAPI = jogo.teams.home.id;
      const idVisitanteAPI = jogo.teams.away.id;

      const nossoIDMandante = dicionarioTimes[idMandanteAPI];
      const nossoIDVisitante = dicionarioTimes[idVisitanteAPI];

      // Nós só podemos salvar se PELO MENOS UM dos times estiver no dicionário.
      // E, para não dar erro no banco, o outro time PRECISA existir no Supabase, 
      // mas como estamos testando, vamos ignorar se não tivermos o cadastro do outro time.
      if (nossoIDMandante) {
        
        await supabase.from('partidas').upsert({
          id: jogo.fixture.id, 
          mandante_id: nossoIDMandante,
          visitante_id: nossoIDVisitante || 2, // Gambiarra de Teste: Força o Visitante como Palmeiras (ID 2)
          gols_mandante: jogo.goals?.home || 0, // Proteção contra nulos
          gols_visitante: jogo.goals?.away || 0,
          status: jogo.fixture?.status?.short || 'AO VIVO' // Correção do Caminho Certo da API!
        });

        jogosAtualizados++;
      }
    }
    
    return NextResponse.json({
      sucesso: true,
      mensagem: 'Varredura concluída!',
      jogos_atualizados_no_supabase: jogosAtualizados
    });

  } catch (error: any) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}