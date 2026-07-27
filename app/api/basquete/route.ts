import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 1. Puxa a chave de segurança que você acabou de colocar no .env.local
    const apiKey = process.env.BALLDONTLIE_KEY;

    if (!apiKey) {
      return NextResponse.json({ erro: 'Chave da API da NBA não encontrada no .env.local' }, { status: 500 });
    }

    // 2. O Robô faz a requisição para a API externa (Buscando jogadores da NBA)
    const resposta = await fetch('https://api.balldontlie.io/v1/players', {
      method: 'GET',
      headers: {
        'Authorization': apiKey, // A sua credencial entra aqui de forma invisível
        'Content-Type': 'application/json'
      }
    });

    if (!resposta.ok) {
      throw new Error(`Falha na API externa: ${resposta.status}`);
    }

    // 3. Captura os dados e envia de volta para nós
    const dados = await resposta.json();
    
    return NextResponse.json({
      sucesso: true,
      mensagem: 'Robô da NBA conectado com sucesso!',
      total_encontrado: dados.data.length,
      amostra_jogadores: dados.data.slice(0, 5) // Mostra os 5 primeiros só para testarmos
    });

  } catch (error: any) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}