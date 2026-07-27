"use client";

import BarraBusca from './components/BarraBusca';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [partidas, setPartidas] = useState<any[]>([]);
  const [timeSelecionado, setTimeSelecionado] = useState('Todos');
  const [mercadoSelecionado, setMercadoSelecionado] = useState('Todos');
  const [amostragem, setAmostragem] = useState('Todos');
  const [carregando, setCarregando] = useState(false);
  const [alvosCadastrados, setAlvosCadastrados] = useState<any[]>([]);
  const [apiRestante, setApiRestante] = useState<string | number>('--'); // NOVO: Estado da API

  // =========================================================================
  // O CÉREBRO DEFINITIVO (Validação de Mercados e Props)
  // (Este bloco será totalmente refeito no backend no próximo passo, 
  // mas mantemos aqui por enquanto para não quebrar a tela)
  // =========================================================================
  const verificarResultado = (odd: any, partida: any) => {
    if (odd.mercado === 'Over 2.5') {
      const totalGols = partida.gols_mandante + partida.gols_visitante;
      return (odd.selecao === 'Over' && totalGols > 2.5) || (odd.selecao === 'Under' && totalGols < 2.5) ? 'GREEN' : 'RED';
    }
    if (odd.mercado === 'Resultado Final') {
      if (odd.selecao === 'Mandante' && partida.gols_mandante > partida.gols_visitante) return 'GREEN';
      if (odd.selecao === 'Visitante' && partida.gols_visitante > partida.gols_mandante) return 'GREEN';
      if (odd.selecao === 'Empate' && partida.gols_mandante === partida.gols_visitante) return 'GREEN';
      return 'RED';
    }
    return 'PENDENTE';
  };

  const calcularEstatisticas = () => {
    let greens = 0, reds = 0, lucroAtual = 0;
    let sequencia: string[] = []; 
    let historicoBanca: number[] = [0]; 

    [...partidas].reverse().forEach(partida => {
      partida.odds?.forEach((odd: any) => {
        // Se o mercado filtrado for diferente do mercado da odd, pula
        if (mercadoSelecionado !== 'Todos' && odd.mercado !== mercadoSelecionado) return;
        const resultado = verificarResultado(odd, partida);
        
        if (resultado === 'GREEN') { 
          greens++; 
          lucroAtual += (odd.valor - 1); 
          sequencia.push('GREEN'); 
        } else if (resultado === 'RED') { 
          reds++; 
          lucroAtual -= 1; 
          sequencia.push('RED'); 
        }
        if (resultado !== 'PENDENTE') historicoBanca.push(parseFloat(lucroAtual.toFixed(2)));
      });
    });

    const totalInvestido = greens + reds;
    return { 
      greens, reds, 
      taxaAcerto: totalInvestido > 0 ? ((greens / totalInvestido) * 100).toFixed(1) : '0.0', 
      lucroUnidades: lucroAtual.toFixed(2), 
      roi: totalInvestido > 0 ? ((lucroAtual / totalInvestido) * 100).toFixed(1) : '0.0', 
      totalInvestido, sequencia, historicoBanca 
    };
  };

  const calcularMedias = () => {
    if (partidas.length === 0) return { gols: '0.0', cantos: '0.0' };
    let totalGols = 0, totalCantos = 0;
    partidas.forEach(partida => {
      totalGols += (partida.gols_mandante || 0) + (partida.gols_visitante || 0);
      totalCantos += (partida.escanteios_mandante || 0) + (partida.escanteios_visitante || 0);
    });
    return {
      gols: (totalGols / partidas.length).toFixed(1),
      cantos: (totalCantos / partidas.length).toFixed(1)
    };
  };

  const stats = calcularEstatisticas();
  const medias = calcularMedias();
  
  const maxLucro = Math.max(...stats.historicoBanca, 1);
  const minLucro = Math.min(...stats.historicoBanca, 0);
  const amplitude = maxLucro - minLucro || 1;

  // =========================================================================
  // FETCH SOB DEMANDA
  // =========================================================================
  useEffect(() => {
    async function carregarAlvos() {
      const { data } = await supabase.from('rastreadores').select('*');
      if (data) setAlvosCadastrados(data);
    }
    carregarAlvos();
  }, []);

  async function buscarDados() {
    setCarregando(true);
    
    const alvo = alvosCadastrados.find(a => a.nome === timeSelecionado);
    
    if (!alvo || timeSelecionado === 'Todos') {
      alert("⚠️ Por favor, selecione um rastreador específico no filtro lateral para processar.");
      setCarregando(false);
      return;
    }

    try {
      // Mandamos agora também o "mercadoSelecionado" para a API saber o que deve buscar
      const resposta = await fetch(`/api/processar?id=${alvo.id_externo}&categoria=${alvo.esporte}&mercado=${mercadoSelecionado}`);
      const dados = await resposta.json();
      
      if (dados.sucesso) {
        let dadosFiltrados = dados.partidas;
        if (amostragem !== 'Todos') dadosFiltrados = dadosFiltrados.slice(0, parseInt(amostragem));
        setPartidas(dadosFiltrados);
        
        // NOVO: Atualiza a contagem da API na tela
        if (dados.apiRestante) setApiRestante(dados.apiRestante);
      } else {
        console.error("Erro na API:", dados.erro);
      }
    } catch (error) {
      console.error("Erro ao buscar na gringa:", error);
    }
    
    setCarregando(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex font-sans">
      
      {/* BARRA LATERAL (FILTROS) */}
      <aside className="w-72 bg-gray-900 border-r border-gray-800 p-6 hidden md:flex md:flex-col h-screen sticky top-0">
        <h2 className="text-xl font-black text-emerald-400 mb-8 border-b border-gray-800 pb-4 tracking-tight">
          Backtest<span className="text-white">PRO</span>
        </h2>
        <div className="space-y-6 mb-8">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Time/Jogador Analisado</label>
            <select value={timeSelecionado} onChange={(e) => setTimeSelecionado(e.target.value)} className="w-full bg-gray-950 border border-gray-800 text-gray-300 text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-emerald-500 transition-all">
              <option value="Todos">-- Escolha um Rastreador --</option>
              {alvosCadastrados.map((alvo) => (
                <option key={alvo.id} value={alvo.nome}>
                  {alvo.nome} ({alvo.esporte.split('_')[0].toUpperCase()})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mercado Específico</label>
            <select value={mercadoSelecionado} onChange={(e) => setMercadoSelecionado(e.target.value)} className="w-full bg-gray-950 border border-gray-800 text-gray-300 text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-emerald-500 transition-all">
              <optgroup label="Básico (Baixo Consumo API)">
                <option value="Todos">Visão Geral (Apenas Placar)</option>
                <option value="Resultado Final">Match Odds (1x2)</option>
                <option value="Over 1.5">Gols: Over/Under 1.5</option>
                <option value="Over 2.5">Gols: Over/Under 2.5</option>
                <option value="Over 3.5">Gols: Over/Under 3.5</option>
                <option value="Ambas Marcam">Gols: Ambas Marcam (BTTS)</option>
              </optgroup>
              <optgroup label="Avançado (Médio Consumo API)">
                <option value="Escanteios HT">Cantos: Primeiro Tempo (HT)</option>
                <option value="Escanteios Jogo">Cantos: Partida Completa</option>
                <option value="Cartões">Cartões Totais</option>
                <option value="Faltas Jogo">Faltas: Total da Partida</option>
              </optgroup>
              <optgroup label="Player Props (Alto Consumo API)">
                <option value="Player Chutes">Jogador: Chutes (Total/Gol)</option>
                <option value="Player Faltas">Jogador: Faltas (Feitas/Sofridas)</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Período de Corte</label>
            <select value={amostragem} onChange={(e) => setAmostragem(e.target.value)} className="w-full bg-gray-950 border border-gray-800 text-gray-300 text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-emerald-500 transition-all">
              <option value="3">Últimos 3 Jogos</option>
              <option value="5">Últimos 5 Jogos</option>
              <option value="10">Últimos 10 Jogos</option>
            </select>
          </div>
        </div>
        <button onClick={buscarDados} disabled={carregando} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-95 transition-all">
          {carregando ? 'PROCESSANDO...' : 'PROCESSAR DADOS'}
        </button>
        
        {/* NOVO: Medidor de API */}
        <div className="mt-6 text-center border-t border-gray-800 pt-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Cota Diária da API</p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${apiRestante !== '--' && Number(apiRestante) > 20 ? 'bg-emerald-500' : apiRestante !== '--' ? 'bg-red-500' : 'bg-gray-600'}`}></div>
            <p className="text-xl font-black text-white">{apiRestante}</p>
          </div>
          <p className="text-[9px] text-gray-600 mt-1">Reseta às 21:00 (Horário de Brasília)</p>
        </div>

      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="mb-10">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-4xl font-black text-gray-100 mb-2 tracking-tight">Desempenho Estratégico</h1>
              <p className="text-gray-400 text-sm">Parâmetros Ativos: <span className="text-emerald-400 font-semibold">{timeSelecionado} | {mercadoSelecionado} | {amostragem === 'Todos' ? 'Tudo' : `Últimos ${amostragem}`}</span></p>
            </div>
            {carregando && <span className="text-emerald-500 text-sm font-bold animate-pulse bg-emerald-900/30 px-3 py-1 rounded-full">Calculando sob demanda...</span>}
          </div>

          <BarraBusca />

          {/* PAINEL FINANCEIRO TOP */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-5 rounded-2xl shadow-lg">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Win Rate Global</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-white">{stats.taxaAcerto}%</p>
                <span className="text-xs font-semibold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{stats.greens}G / {stats.reds}R</span>
              </div>
              <div className="flex gap-1 mt-4">
                {stats.sequencia.length > 0 ? stats.sequencia.map((res, i) => (
                  <div key={i} className={`w-full h-2 rounded-full ${res === 'GREEN' ? 'bg-emerald-500' : 'bg-red-500 opacity-80'}`}></div>
                )) : <span className="text-xs text-gray-600">--</span>}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-5 rounded-2xl shadow-lg">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Total Investido</p>
              <p className="text-4xl font-black text-gray-200">{stats.totalInvestido}.00 <span className="text-base font-normal text-gray-500">U</span></p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-5 rounded-2xl shadow-lg">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Lucro / Prejuízo</p>
              <p className={`text-4xl font-black ${parseFloat(stats.lucroUnidades) > 0 ? 'text-emerald-400' : parseFloat(stats.lucroUnidades) < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {parseFloat(stats.lucroUnidades) > 0 ? '+' : ''}{stats.lucroUnidades} <span className="text-base font-normal opacity-50">U</span>
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 z-10 relative">ROI (Retorno)</p>
              <p className={`text-4xl font-black z-10 relative ${parseFloat(stats.roi) > 0 ? 'text-emerald-400' : parseFloat(stats.roi) < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {parseFloat(stats.roi) > 0 ? '+' : ''}{stats.roi}%
              </p>
              <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-20 ${parseFloat(stats.roi) > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            </div>
          </div>

          {/* SESSÃO SECUNDÁRIA: MÉDIAS E GRÁFICO */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="col-span-1 flex flex-col gap-4">
              <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl flex items-center justify-between shadow-md">
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Média de Gols</p>
                  <p className="text-2xl font-black text-gray-200 mt-1">{medias.gols}</p>
                </div>
                <div className="h-10 w-10 bg-gray-950 rounded-full flex items-center justify-center text-lg border border-gray-800 shadow-inner">⚽</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl flex items-center justify-between shadow-md">
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Média de Escanteios</p>
                  <p className="text-2xl font-black text-gray-200 mt-1">{medias.cantos}</p>
                </div>
                <div className="h-10 w-10 bg-gray-950 rounded-full flex items-center justify-center text-lg border border-gray-800 shadow-inner">🚩</div>
              </div>
            </div>

            <div className="col-span-2 bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-md flex flex-col">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">Curva de Capital (Banca)</p>
              <div className="flex-1 flex items-end gap-1 h-32 w-full pt-4 relative border-b border-gray-800">
                <div className="absolute w-full border-t border-dashed border-gray-700" style={{ bottom: `${(Math.abs(minLucro) / amplitude) * 100}%` }}></div>
                
                {stats.historicoBanca.map((valor, idx) => {
                  const percentual = ((valor - minLucro) / amplitude) * 100;
                  const corBarra = valor >= 0 ? 'bg-emerald-500' : 'bg-red-500';
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end relative group">
                      <span className="opacity-0 group-hover:opacity-100 absolute -top-8 text-xs bg-gray-950 px-2 py-1 rounded text-white z-20 pointer-events-none transition-opacity whitespace-nowrap">
                        {valor.toFixed(2)} U
                      </span>
                      <div className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 ease-in-out ${corBarra}`} style={{ height: `${percentual}%`, minHeight: '4px' }}></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        {/* FEED DE JOGOS VALIDADO */}
        <div className="w-full max-w-5xl space-y-6">
          {partidas && partidas.length > 0 ? (
            partidas.map((partida) => {
              const oddsVisiveis = mercadoSelecionado === 'Todos' ? partida.odds : partida.odds?.filter((o: any) => o.mercado === mercadoSelecionado);
              
              // Se tivermos selecionado um mercado específico e o jogo não tiver odds geradas, podemos pular a visualização ou mostrar as stats brutas
              if (!oddsVisiveis || oddsVisiveis.length === 0) return null;

              return (
                <div key={partida.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg hover:border-gray-700 transition-colors">
                  
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800 uppercase tracking-widest">{Array.isArray(partida.campeonatos) ? partida.campeonatos[0]?.nome : partida.campeonatos?.nome}</span>
                      <span className="text-xs font-medium text-gray-500">{new Date(partida.data_jogo).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  <div className="flex justify-center items-center gap-8 mb-8">
                    <span className="text-2xl font-bold w-1/3 text-right text-gray-200">{Array.isArray(partida.mandante) ? partida.mandante[0]?.nome : partida.mandante?.nome}</span>
                    <div className="bg-gray-950 px-8 py-4 rounded-xl border border-gray-800 text-4xl font-black text-white shadow-inner tracking-tighter">
                      {partida.gols_mandante} - {partida.gols_visitante}
                    </div>
                    <span className="text-2xl font-bold w-1/3 text-left text-gray-200">{Array.isArray(partida.visitante) ? partida.visitante[0]?.nome : partida.visitante?.nome}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-950 rounded-xl p-5 border border-gray-800">
                      <h3 className="text-[10px] text-emerald-500/70 mb-4 uppercase tracking-widest font-black flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Análise da Odd
                      </h3>
                      <div className="space-y-3">
                        {oddsVisiveis.map((odd: any) => {
                          const res = verificarResultado(odd, partida);
                          const corFundo = res === 'GREEN' ? 'bg-emerald-950/20 border-emerald-500/30' : res === 'RED' ? 'bg-red-950/20 border-red-500/30' : 'bg-gray-800/30 border-gray-700/50';
                          return (
                            <div key={odd.id} className={`flex justify-between items-center p-3 rounded-lg border ${corFundo}`}>
                              <div className="flex flex-col">
                                <span className="text-gray-300 font-semibold text-sm">{odd.mercado}</span>
                                <span className={`text-xs font-bold uppercase mt-1 ${res === 'GREEN' ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {odd.selecao} • {res}
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="bg-gray-900 text-gray-200 font-bold px-3 py-1 rounded border border-gray-700 text-sm">@ {odd.valor.toFixed(2)}</span>
                                <span className={`text-[10px] font-bold ${res === 'GREEN' ? 'text-emerald-500' : 'text-red-500'}`}>
                                  {res === 'GREEN' ? `+${(odd.valor - 1).toFixed(2)}U` : '-1.00U'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-gray-950 rounded-xl p-5 border border-gray-800">
                      <h3 className="text-[10px] text-gray-500 mb-4 uppercase tracking-widest font-black">Performance Real (Jogo)</h3>
                      <div className="space-y-2">
                        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/50 flex flex-col gap-1">
                          <span className="text-gray-300 font-bold text-xs uppercase">Coletivo</span>
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>Cantos Mandante: <strong className="text-gray-200">{partida.escanteios_mandante || 0}</strong></span>
                            <span>Cantos Visitante: <strong className="text-gray-200">{partida.escanteios_visitante || 0}</strong></span>
                          </div>
                        </div>
                        {partida.estatisticas_jogadores?.map((stat: any) => (
                          <div key={stat.id} className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/50 flex flex-col gap-1">
                            <span className="text-gray-300 font-bold text-xs">{Array.isArray(stat.jogadores) ? stat.jogadores[0]?.nome : stat.jogadores?.nome}</span>
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>Chutes: <strong className="text-gray-200">{stat.chutes}</strong></span>
                              <span>No Gol: <strong className="text-gray-200">{stat.chutes_ao_gol}</strong></span>
                              <span>Faltas: <strong className="text-gray-200">{stat.faltas_cometidas}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
             <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-gray-900/30">
               <p className="text-gray-500 font-semibold uppercase tracking-widest">Esperando Processamento</p>
               <p className="text-gray-600 text-sm mt-2">Selecione um alvo na lateral e clique em Processar Dados.</p>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}