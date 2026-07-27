import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const categoria = searchParams.get('categoria'); // ex: futebol_times

  if (!id || !categoria) {
    return NextResponse.json({ erro: 'Parâmetros ausentes.' }, { status: 400 });
  }

  try {
    // ==========================================
    // PROCESSAMENTO SOB DEMANDA: FUTEBOL (TIMES)
    // ==========================================
    if (categoria === 'futebol_times') {
      const apiSportsKey = process.env.API_SPORTS_KEY;
      
      // Busca os últimos 10 jogos do time exato
      const resposta = await fetch(`https://v3.football.api-sports.io/fixtures?team=${id}&last=10`, {
        headers: { 'x-apisports-key': apiSportsKey! }
      });
      const dados = await resposta.json();

      // Formata os dados no padrão do seu painel de backtest
      const partidasFormatadas = dados.response.map((jogo: any) => ({
        id: jogo.fixture.id,
        data_jogo: jogo.fixture.date,
        gols_mandante: jogo.goals.home,
        gols_visitante: jogo.goals.away,
        escanteios_mandante: 0, // A API-Sports exige uma chamada separada para escanteios
        escanteios_visitante: 0,
        campeonatos: { nome: jogo.league.name, temporada: jogo.league.season },
        mandante: { nome: jogo.teams.home.name },
        visitante: { nome: jogo.teams.away.name },
        // Simulando odds bases para cálculo estático de ROI
        odds: [
          { id: Math.random(), mercado: 'Resultado Final', selecao: 'Mandante', valor: 2.10 },
          { id: Math.random(), mercado: 'Over 2.5', selecao: 'Over', valor: 1.85 },
          { id: Math.random(), mercado: 'Ambas Marcam', selecao: 'Sim', valor: 1.90 }
        ],
        estatisticas_jogadores: []
      }));

      return NextResponse.json({ sucesso: true, partidas: partidasFormatadas });
    }

    // A estrutura para basquete_jogadores e basquete_times entra aqui seguindo a mesma lógica.
    
    return NextResponse.json({ erro: 'Categoria não suportada no processamento ainda.' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}