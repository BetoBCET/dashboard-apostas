import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const categoria = searchParams.get('categoria');
  const mercado = searchParams.get('mercado') || 'Todos';

  if (!id || !categoria) {
    return NextResponse.json({ erro: 'Parâmetros ausentes.' }, { status: 400 });
  }

  try {
    const apiSportsKey = process.env.API_SPORTS_KEY;
    const balldontlieKey = process.env.BALLDONTLIE_KEY;
    let apiRestante: string | number = '--';

    // ==========================================
    // FUTEBOL (TIMES)
    // ==========================================
    if (categoria === 'futebol_times') {
      const resFixtures = await fetch(`https://v3.football.api-sports.io/fixtures?team=${id}&last=10`, {
        headers: { 'x-apisports-key': apiSportsKey! }
      });
      
      apiRestante = resFixtures.headers.get('x-ratelimit-requests-remaining') || '--';
      const dadosFixtures = await resFixtures.json();
      if (!dadosFixtures.response) throw new Error("Erro ao buscar dados brutos da API.");

      const exigeEstatisticas = mercado.includes('Escanteios') || mercado.includes('Cartões') || mercado.includes('Faltas');
      
      // Só busca odds se o usuário não pediu apenas "Visão Geral"
      const buscaOdds = mercado !== 'Todos';

      const partidasFormatadas = await Promise.all(dadosFixtures.response.map(async (jogo: any) => {
        let escanteiosHome = 0, escanteiosAway = 0;
        
        // 1. DADOS COLETIVOS (Escanteios)
        if (exigeEstatisticas) {
          try {
            const resStats = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${jogo.fixture.id}`, {
              headers: { 'x-apisports-key': apiSportsKey! }
            });
            const statsDados = await resStats.json();
            const homeStats = statsDados.response?.find((s: any) => s.team.id === jogo.teams.home.id)?.statistics;
            const awayStats = statsDados.response?.find((s: any) => s.team.id === jogo.teams.away.id)?.statistics;
            const findStat = (stats: any[], type: string) => stats?.find((s: any) => s.type === type)?.value || 0;
            
            escanteiosHome = findStat(homeStats, 'Corner Kicks');
            escanteiosAway = findStat(awayStats, 'Corner Kicks');
          } catch (e) {
            console.log(`Erro ao buscar stats do jogo ${jogo.fixture.id}`);
          }
        }

        // 2. ODDS REAIS (Bet365 - ID 8)
        let oddsReais: any[] = [];
        if (buscaOdds) {
          try {
            const resOdds = await fetch(`https://v3.football.api-sports.io/odds?fixture=${jogo.fixture.id}&bookmaker=8`, {
              headers: { 'x-apisports-key': apiSportsKey! }
            });
            const oddsDados = await resOdds.json();
            
            if (oddsDados.response && oddsDados.response.length > 0) {
              const bookmaker = oddsDados.response[0].bookmakers[0];
              if (bookmaker && bookmaker.bets) {
                bookmaker.bets.forEach((bet: any) => {
                  // Mapeia Resultado Final (1X2)
                  if (bet.name === 'Match Winner') {
                    bet.values.forEach((v: any) => oddsReais.push({ id: Math.random(), mercado: 'Resultado Final', selecao: v.value === 'Home' ? 'Mandante' : v.value === 'Away' ? 'Visitante' : 'Empate', valor: parseFloat(v.odd) }));
                  }
                  // Mapeia Over/Under (Extrai o número puro do texto, ex: "Over 2.5")
                  if (bet.name === 'Goals Over/Under') {
                    bet.values.forEach((v: any) => oddsReais.push({ id: Math.random(), mercado: `Over ${v.value.replace(/[^0-9.]/g, '')}`, selecao: v.value.includes('Over') ? 'Over' : 'Under', valor: parseFloat(v.odd) }));
                  }
                  // Mapeia Ambas Marcam
                  if (bet.name === 'Both Teams Score') {
                    bet.values.forEach((v: any) => oddsReais.push({ id: Math.random(), mercado: 'Ambas Marcam', selecao: v.value === 'Yes' ? 'Sim' : 'Não', valor: parseFloat(v.odd) }));
                  }
                });
              }
            }
          } catch (e) {
            console.log(`Erro ao buscar odds do jogo ${jogo.fixture.id}`);
          }
        }

        return {
          id: jogo.fixture.id,
          data_jogo: jogo.fixture.date,
          gols_mandante: jogo.goals.home,
          gols_visitante: jogo.goals.away,
          escanteios_mandante: escanteiosHome,
          escanteios_visitante: escanteiosAway,
          campeonatos: { nome: jogo.league.name, temporada: jogo.league.season },
          mandante: { nome: jogo.teams.home.name },
          visitante: { nome: jogo.teams.away.name },
          odds: oddsReais,
          estatisticas_jogadores: []
        };
      }));

      return NextResponse.json({ sucesso: true, partidas: partidasFormatadas, apiRestante });
    }

    // ==========================================
    // BASQUETE (TIMES DA NBA)
    // ==========================================
    if (categoria === 'basquete_times') {
      const resposta = await fetch(`https://api.balldontlie.io/v1/games?team_ids[]=${id}&per_page=10`, {
        headers: { 'Authorization': balldontlieKey! }
      });
      apiRestante = resposta.headers.get('x-ratelimit-remaining') || 'Ilimitado';
      const dados = await resposta.json();

      const partidasFormatadas = dados.data.map((jogo: any) => ({
        id: jogo.id,
        data_jogo: jogo.date,
        gols_mandante: jogo.home_team_score, 
        gols_visitante: jogo.visitor_team_score,
        campeonatos: { nome: 'NBA', temporada: jogo.season },
        mandante: { nome: jogo.home_team.full_name },
        visitante: { nome: jogo.visitor_team.full_name },
        odds: [{ id: Math.random(), mercado: 'Resultado Final', selecao: 'Mandante', valor: 1.90 }],
        estatisticas_jogadores: []
      }));

      return NextResponse.json({ sucesso: true, partidas: partidasFormatadas, apiRestante });
    }

    return NextResponse.json({ erro: 'Categoria inválida.' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}