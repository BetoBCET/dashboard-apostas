import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Conecta o Backend ao Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const categoria = searchParams.get('categoria');

  if (!id || !categoria) {
    return NextResponse.json({ erro: 'Parâmetros ausentes.' }, { status: 400 });
  }

  try {
    const apiSportsKey = process.env.API_SPORTS_KEY;
    let apiRestante: string | number = '--';

    if (categoria === 'futebol_times') {
      // 1. Gasta 1 API para descobrir quais foram os últimos 10 jogos
      const resFixtures = await fetch(`https://v3.football.api-sports.io/fixtures?team=${id}&last=10`, {
        headers: { 'x-apisports-key': apiSportsKey! }
      });
      
      apiRestante = resFixtures.headers.get('x-ratelimit-requests-remaining') || '--';
      const dadosFixtures = await resFixtures.json();
      
      if (!dadosFixtures.response) throw new Error("Erro ao consultar a API.");

      const jogosProntos: any[] = [];
      const idsParaBuscar: number[] = [];

      // 2. Verifica um por um no seu Supabase (Custo API: Zero)
      for (const jogo of dadosFixtures.response) {
        const { data: cache } = await supabase
          .from('cache_jogos')
          .select('*')
          .eq('id_partida', jogo.fixture.id)
          .single();

        // Se o jogo está salvo e já acabou (FT), usa o banco!
        if (cache && cache.estatisticas_importadas) {
          jogosProntos.push(cache.dados_completos);
        } else {
          // Se não tem, coloca na lista de compras
          idsParaBuscar.push(jogo.fixture.id);
        }
      }

      // 3. Compra em Lote (Gasta só 1 API para trazer todos os jogos faltantes com detalhes)
      if (idsParaBuscar.length > 0) {
        const stringIds = idsParaBuscar.join('-');
        const resLote = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${stringIds}`, {
          headers: { 'x-apisports-key': apiSportsKey! }
        });
        
        apiRestante = resLote.headers.get('x-ratelimit-requests-remaining') || apiRestante;
        const dadosLote = await resLote.json();

        if (dadosLote.response) {
          for (const jogoLote of dadosLote.response) {
            const dadosFormatados = {
              id: jogoLote.fixture.id,
              data_jogo: jogoLote.fixture.date,
              gols_mandante: jogoLote.goals.home,
              gols_visitante: jogoLote.goals.away,
              gols_mandante_ht: jogoLote.score.halftime.home,
              gols_visitante_ht: jogoLote.score.halftime.away,
              campeonatos: { nome: jogoLote.league.name, temporada: jogoLote.league.season },
              mandante: { nome: jogoLote.teams.home.name },
              visitante: { nome: jogoLote.teams.away.name }
            };

            // 4. Guarda no Cofre (Supabase) para nunca mais precisar gastar API com este jogo
            await supabase.from('cache_jogos').upsert({
              id_partida: jogoLote.fixture.id,
              id_time: parseInt(id),
              data_jogo: jogoLote.fixture.date,
              status: jogoLote.fixture.status.short,
              mandante: jogoLote.teams.home.name,
              visitante: jogoLote.teams.away.name,
              gols_mandante: jogoLote.goals.home,
              gols_visitante: jogoLote.goals.away,
              gols_mandante_ht: jogoLote.score.halftime.home,
              gols_visitante_ht: jogoLote.score.halftime.away,
              dados_completos: dadosFormatados,
              estatisticas_importadas: jogoLote.fixture.status.short === 'FT' // Trava como definitivo se já acabou
            });

            jogosProntos.push(dadosFormatados);
          }
        }
      }

      // Ordena do mais recente para o mais antigo antes de mandar pra tela
      jogosProntos.sort((a, b) => new Date(b.data_jogo).getTime() - new Date(a.data_jogo).getTime());

      return NextResponse.json({ sucesso: true, partidas: jogosProntos, apiRestante });
    }

    return NextResponse.json({ erro: 'Categoria inválida.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}