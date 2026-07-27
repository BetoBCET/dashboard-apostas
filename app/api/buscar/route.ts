import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoria = searchParams.get('categoria'); 
  const termo = searchParams.get('termo');     

  if (!categoria || !termo) {
    return NextResponse.json({ erro: 'Faltam parâmetros.' }, { status: 400 });
  }

  try {
    const apiSportsKey = process.env.API_SPORTS_KEY;
    const balldontlieKey = process.env.BALLDONTLIE_KEY;

    // 1. FUTEBOL: TIMES
    if (categoria === 'futebol_times') {
      const resposta = await fetch(`https://v3.football.api-sports.io/teams?search=${termo}`, {
        headers: { 'x-apisports-key': apiSportsKey!, 'Content-Type': 'application/json' }
      });
      const dados = await resposta.json();
      const resultados = dados.response.map((item: any) => ({
        id_externo: item.team.id,
        nome: item.team.name,
        detalhe: item.team.country
      }));
      return NextResponse.json({ sucesso: true, resultados });
    }

    // 2. FUTEBOL: JOGADORES
    if (categoria === 'futebol_jogadores') {
      const resposta = await fetch(`https://v3.football.api-sports.io/players/profiles?search=${termo}`, {
        headers: { 'x-apisports-key': apiSportsKey!, 'Content-Type': 'application/json' }
      });
      const dados = await resposta.json();
      const resultados = dados.response.map((item: any) => ({
        id_externo: item.player.id,
        nome: `${item.player.firstname} ${item.player.lastname}`,
        detalhe: item.player.nationality
      }));
      return NextResponse.json({ sucesso: true, resultados });
    }

    // 3. BASQUETE: JOGADORES
    if (categoria === 'basquete_jogadores') {
      const resposta = await fetch(`https://api.balldontlie.io/v1/players?search=${termo}`, {
        headers: { 'Authorization': balldontlieKey!, 'Content-Type': 'application/json' }
      });
      const dados = await resposta.json();
      const resultados = dados.data.map((jogador: any) => ({
        id_externo: jogador.id,
        nome: `${jogador.first_name} ${jogador.last_name}`,
        detalhe: jogador.team.full_name
      }));
      return NextResponse.json({ sucesso: true, resultados });
    }

    // 4. BASQUETE: TIMES (Balldontlie não tem search direto pra times, então filtramos a lista de 30)
    if (categoria === 'basquete_times') {
      const resposta = await fetch(`https://api.balldontlie.io/v1/teams`, {
        headers: { 'Authorization': balldontlieKey!, 'Content-Type': 'application/json' }
      });
      const dados = await resposta.json();
      const filtrados = dados.data.filter((time: any) => 
        time.full_name.toLowerCase().includes(termo.toLowerCase())
      );
      const resultados = filtrados.map((time: any) => ({
        id_externo: time.id,
        nome: time.full_name,
        detalhe: time.conference
      }));
      return NextResponse.json({ sucesso: true, resultados });
    }

    return NextResponse.json({ erro: 'Categoria inválida' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}