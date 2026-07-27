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
    // FUTEBOL (TIMES) - CHAVEAMENTO INTELIGENTE
    // ==========================================
    if (categoria === 'futebol_times') {
      
      // 1. ROTA BÁSICA (Custa 1 API): Puxa o esqueleto dos últimos 10 jogos
      const resFixtures = await fetch(`https://v3.football.api-sports.io/fixtures?team=${id}&last=10`, {
        headers: { 'x-apisports-key': apiSportsKey! }
      });
      
      // CAPTURA A COTA DA API: Lendo o cabeçalho oculto da resposta
      apiRestante = resFixtures.headers.get('x-ratelimit-requests-remaining') || '--';
      
      const dadosFixtures = await resFixtures.json();
      if (!dadosFixtures.response) throw new Error("Erro ao buscar dados brutos da API-Sports.");

      // 2. DISJUNTOR DE CONSUMO (Decide se vai gastar mais requisições ou não)
      const exigeEstatisticas = mercado.includes('Escanteios') || mercado.includes('Cartões') || mercado.includes('Faltas');
      const exigePlayers = mercado.includes('Player');

      // 3. PROCESSAMENTO DOS JOGOS
      const partidasFormatadas = await Promise.all(dadosFixtures.response.map(async (jogo: any) => {
        let escanteiosHome = 0;
        let escanteiosAway = 0;
        let cartoesAmarelos = 0;
        
        // CHAVE ABERTA: Só gasta cota extra se o mercado selecionado exigir
        if (exigeEstatisticas) {
          try {
            // Nota: Em um ambiente de produção pesado, colocaríamos um delay aqui para não tomar block por requisições simultâneas.
            const resStats = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${jogo.fixture.id}`, {
              headers: { 'x-apisports-key': apiSportsKey! }
            });
            const statsDados = await resStats.json();
            
            // Extrai escanteios da resposta se existirem
            const homeStats = statsDados.response?.find((s: any) => s.team.id === jogo.teams.home.id)?.statistics;
            const awayStats = statsDados.response?.find((s: any) => s.team.id === jogo.teams.away.id)?.statistics;
            
            const findStat = (stats: any[], type: string) => stats?.find((s: any) => s.type === type)?.value || 0;
            
            escanteiosHome = findStat(homeStats, 'Corner Kicks');
            escanteiosAway = findStat(awayStats, 'Corner Kicks');
          } catch (e) {
            console.log(`Erro ao buscar stats do jogo ${jogo.fixture.id}`);
          }
        }

        // =========================================================
        // ODDS (Linhas Reais)
        // Por enquanto, simulamos uma odd média padrão para o backtest de Gols e Resultado.
        // O próximo nível seria acionar a rota /odds para puxar o valor real de fechamento da Bet365.
        // =========================================================
        let oddsAtivas = [
          { id: Math.random(), mercado: 'Resultado Final', selecao: 'Mandante', valor: 1.95 },
          { id: Math.random(), mercado: 'Resultado Final', selecao: 'Visitante', valor: 3.10 },
          { id: Math.random(), mercado: 'Resultado Final', selecao: 'Empate', valor: 3.50 },
          { id: Math.random(), mercado: 'Over 2.5', selecao: 'Over', valor: 1.85 },
          { id: Math.random(), mercado: 'Over 2.5', selecao: 'Under', valor: 1.90 },
          { id: Math.random(), mercado: 'Ambas Marcam', selecao: 'Sim', valor: 1.75 },
          { id: Math.random(), mercado: 'Escanteios Jogo', selecao: 'Over 10.5', valor: 1.83 }
        ];

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
          odds: oddsAtivas,
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
      // Balldontlie também tem headers de rate limit (x-ratelimit-remaining), capturamos aqui:
      apiRestante = resposta.headers.get('x-ratelimit-remaining') || 'Ilimitado';
      const dados = await resposta.json();

      const partidasFormatadas = dados.data.map((jogo: any) => ({
        id: jogo.id,
        data_jogo: jogo.date,
        gols_mandante: jogo.home_team_score, // Adaptamos pontos para 'gols' pro gráfico ler
        gols_visitante: jogo.visitor_team_score,
        campeonatos: { nome: 'NBA', temporada: jogo.season },
        mandante: { nome: jogo.home_team.full_name },
        visitante: { nome: jogo.visitor_team.full_name },
        odds: [
          { id: Math.random(), mercado: 'Resultado Final', selecao: 'Mandante', valor: 1.90 }
        ],
        estatisticas_jogadores: []
      }));

      return NextResponse.json({ sucesso: true, partidas: partidasFormatadas, apiRestante });
    }

    return NextResponse.json({ erro: 'Processamento para essa categoria ainda em expansão.' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}