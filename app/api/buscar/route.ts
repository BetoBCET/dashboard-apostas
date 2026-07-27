import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Pega o que você digitou na URL
  const { searchParams } = new URL(request.url);
  const esporte = searchParams.get('esporte'); // 'futebol' ou 'basquete'
  const termo = searchParams.get('termo');     // ex: 'Vasco' ou 'LeBron'

  if (!esporte || !termo) {
    return NextResponse.json(
      { erro: 'Você precisa informar o esporte e o termo de busca.' },
      { status: 400 }
    );
  }

  try {
    // ==========================================
    // BUSCA DE TIMES (FUTEBOL)
    // ==========================================
    if (esporte === 'futebol') {
      const apiKey = process.env.API_SPORTS_KEY;
      const resposta = await fetch(`https://v3.football.api-sports.io/teams?search=${termo}`, {
        headers: { 'x-apisports-key': apiKey!, 'Content-Type': 'application/json' }
      });
      const dados = await resposta.json();
      
      // Filtra só o essencial para devolver para a sua tela
      const resultados = dados.response.map((item: any) => ({
        id_externo: item.team.id,
        nome: item.team.name,
        logo: item.team.logo,
        pais: item.team.country
      }));

      return NextResponse.json({ sucesso: true, resultados });
    }

    // ==========================================
    // BUSCA DE JOGADORES (NBA)
    // ==========================================
    if (esporte === 'basquete') {
      const apiKey = process.env.BALLDONTLIE_KEY;
      const resposta = await fetch(`https://api.balldontlie.io/v1/players?search=${termo}`, {
        headers: { 'Authorization': apiKey!, 'Content-Type': 'application/json' }
      });
      const dados = await resposta.json();

      // Filtra os dados do jogador de basquete
      const resultados = dados.data.map((jogador: any) => ({
        id_externo: jogador.id,
        nome: `${jogador.first_name} ${jogador.last_name}`,
        time: jogador.team.full_name,
        posicao: jogador.position
      }));

      return NextResponse.json({ sucesso: true, resultados });
    }

    return NextResponse.json({ erro: 'Esporte inválido' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}