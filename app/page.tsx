"use client";

import BarraBusca from './components/BarraBusca';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [partidas, setPartidas] = useState<any[]>([]);
  const [timeSelecionado, setTimeSelecionado] = useState('Todos');
  const [mercadoSelecionado, setMercadoSelecionado] = useState('Todos');
  const [amostragem, setAmostragem] = useState('Todos');
  const [carregando, setCarregando] = useState(true);

  // =========================================================================
  // O CÉREBRO DEFINITIVO (Validação de Mercados e Props)
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
    if (odd.mercado === 'Player Props') {
      if (odd.selecao.includes('Arrascaeta')) {
        const stats = partida.estatisticas_jogadores?.find((s: any) => s.jogadores?.nome === 'Arrascaeta');
        return stats && stats.faltas_cometidas > 1.5 ? 'GREEN' : 'RED';
      }
      if (odd.selecao.includes('Calleri')) {
        const stats = partida.estatisticas_jogadores?.find((s: any) => s.jogadores?.nome === 'Calleri');
        return stats && stats.chutes_ao_gol > 1.5 ? 'GREEN' : 'RED';
      }
    }
    if (odd.mercado === 'Ambas Marcam') {
      const ambas = partida.gols_mandante > 0 && partida.gols_visitante > 0;
      return (odd.selecao === 'Sim' && ambas) || (odd.selecao === 'Não' && !ambas) ? 'GREEN' : 'RED';
    }
    if (odd.mercado === 'Escanteios') {
      const totalEscanteios = (partida.escanteios_mandante || 0) + (partida.escanteios_visitante || 0);
      return (odd.selecao === 'Over 10.5' && totalEscanteios > 10.5) ? 'GREEN' : 'RED';
    }
    return 'PENDENTE';
  };

  // =========================================================================
  // CALCULADORA DE ESTATÍSTICAS E GRÁFICO ACUMULADO
  // =========================================================================
  const calcularEstatisticas = () => {
    let greens = 0, reds = 0, lucroAtual = 0;
    let sequencia: string[] = []; 
    let historicoBanca: number[] = [0]; // Começa com lucro zero

    [...partidas].reverse().forEach(partida => {
      partida.odds?.forEach((odd: any) => {
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
        // Registra o saldo após cada aposta validada para montar o gráfico
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
  
  const maxLucro = Math.max(...stats.historicoBanca, 1); // Evita divisão por zero no gráfico
  const minLucro = Math.min(...stats.historicoBanca, 0);
  const amplitude = maxLucro - minLucro || 1;

  async function buscarDados() {
    setCarregando(true);
    let query = supabase.from('partidas').select(`
        id, data_jogo, gols_mandante, gols_visitante, escanteios_mandante, escanteios_visitante, status,
        campeonatos (nome, temporada),
        mandante:times!mandante_id (nome),
        visitante:times!visitante_id (nome),
        odds (id, mercado, selecao, valor),
        estatisticas_jogadores (id, chutes, chutes_ao_gol, faltas_cometidas, jogadores (nome))
      `).order('data_jogo', { ascending: false });

    const { data, error } = await query;
    if (!error && data) {
      let dadosFiltrados = data;
      if (timeSelecionado !== 'Todos') {
        dadosFiltrados = dadosFiltrados.filter((p: any) => {
          const m = Array.isArray(p.mandante) ? p.mandante[0]?.nome : p.mandante?.nome;
          const v = Array.isArray(p.visitante) ? p.visitante[0]?.nome : p.visitante?.nome;
          return m === timeSelecionado || v === timeSelecionado;
        });
      }
      if (amostragem !== 'Todos') dadosFiltrados = dadosFiltrados.slice(0, parseInt(amostragem));
      setPartidas(dadosFiltrados);
    }
    setCarregando(false);
  }

  useEffect(() => { buscarDados(); }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex font-sans">
      
      {/* BARRA LATERAL (FILTROS) */}
      <aside className="w-72 bg-gray-900 border-r border-gray-800 p-6 hidden md:flex md:flex-col h-screen sticky top-0">
        <h2 className="text-xl font-black text-emerald-400 mb-8 border-b border-gray-800 pb-4 tracking-tight">
          Backtest<span className="text-white">PRO</span>
        </h2>
        <div className="space-y-6 mb-8">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Time Analisado</label>
            <select value={timeSelecionado} onChange={(e) => setTimeSelecionado(e.target.value)} className="w-full bg-gray-950 border border-gray-800 text-gray-300 text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-emerald-500 transition-all">
              <option value="Todos">Todos os Times</option>
              <option value="Flamengo">Flamengo</option>
              <option value="Palmeiras">Palmeiras</option>
              <option value="São Paulo">São Paulo</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mercado</label>
            <select value={mercadoSelecionado} onChange={(e) => setMercadoSelecionado(e.target.value)} className="w-full bg-gray-950 border border-gray-800 text-gray-300 text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-emerald-500 transition-all">
              <option value="Todos">Todos os Mercados</option>
              <option value="Resultado Final">Match Odds (1x2)</option>
              <option value="Over 2.5">Gols: Over/Under 2.5</option>
              <option value="Ambas Marcam">Gols: Ambas Marcam (BTTS)</option>
              <option value="Escanteios">Cantos: Escanteios</option>
              <option value="Player Props">Especiais: Player Props</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Período de Corte</label>
            <select value={amostragem} onChange={(e) => setAmostragem(e.target.value)} className="w-full bg-gray-950 border border-gray-800 text-gray-300 text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-emerald-500 transition-all">
              <option value="Todos">Histórico Completo</option>
              <option value="3">Últimos 3 Jogos</option>
              <option value="5">Últimos 5 Jogos</option>
            </select>
          </div>
        </div>
        <button onClick={buscarDados} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg mt-auto shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-95 transition-all">
          PROCESSAR DADOS
        </button>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="mb-10">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-4xl font-black text-gray-100 mb-2 tracking-tight">Desempenho Estratégico</h1>
              <p className="text-gray-400 text-sm">Parâmetros Ativos: <span className="text-emerald-400 font-semibold">{timeSelecionado} | {mercadoSelecionado} | {amostragem === 'Todos' ? 'Tudo' : `Últimos ${amostragem}`}</span></p>
            </div>
            {carregando && <span className="text-emerald-500 text-sm font-bold animate-pulse bg-emerald-900/30 px-3 py-1 rounded-full">Buscando dados...</span>}
          </div>

          {/* NOVA BARRA DE BUSCA ADICIONADA AQUI */}
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
              {/* Efeito visual no fundo do card de ROI */}
              <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-20 ${parseFloat(stats.roi) > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            </div>
          </div>

          {/* SESSÃO SECUNDÁRIA: MÉDIAS E GRÁFICO */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {/* Bloco de Médias Táticas */}
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

            {/* GRÁFICO DE EVOLUÇÃO (NATIVO TAILWIND) */}
            <div className="col-span-2 bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-md flex flex-col">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">Curva de Capital (Banca)</p>
              <div className="flex-1 flex items-end gap-1 h-32 w-full pt-4 relative border-b border-gray-800">
                {/* Linha Zero */}
                <div className="absolute w-full border-t border-dashed border-gray-700" style={{ bottom: `${(Math.abs(minLucro) / amplitude) * 100}%` }}></div>
                
                {stats.historicoBanca.map((valor, idx) => {
                  const percentual = ((valor - minLucro) / amplitude) * 100;
                  const corBarra = valor >= 0 ? 'bg-emerald-500' : 'bg-red-500';
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end relative group">
                      {/* Tooltip invisível que aparece no hover */}
                      <span className="opacity-0 group-hover:opacity-100 absolute -top-8 text-xs bg-gray-950 px-2 py-1 rounded text-white z-20 pointer-events-none transition-opacity whitespace-nowrap">
                        {valor.toFixed(2)} U
                      </span>
                      {/* Barra do gráfico */}
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
              if (!oddsVisiveis || oddsVisiveis.length === 0) return null;

              return (
                <div key={partida.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg hover:border-gray-700 transition-colors">
                  
                  {/* Info Topo Card */}
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800 uppercase tracking-widest">{Array.isArray(partida.campeonatos) ? partida.campeonatos[0]?.nome : partida.campeonatos?.nome}</span>
                      <span className="text-xs font-medium text-gray-500">{new Date(partida.data_jogo).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Placar Centralizado */}
                  <div className="flex justify-center items-center gap-8 mb-8">
                    <span className="text-2xl font-bold w-1/3 text-right text-gray-200">{Array.isArray(partida.mandante) ? partida.mandante[0]?.nome : partida.mandante?.nome}</span>
                    <div className="bg-gray-950 px-8 py-4 rounded-xl border border-gray-800 text-4xl font-black text-white shadow-inner tracking-tighter">
                      {partida.gols_mandante} - {partida.gols_visitante}
                    </div>
                    <span className="text-2xl font-bold w-1/3 text-left text-gray-200">{Array.isArray(partida.visitante) ? partida.visitante[0]?.nome : partida.visitante?.nome}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Apostas Rastreadas */}
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

                    {/* Stats Reais */}
                    <div className="bg-gray-950 rounded-xl p-5 border border-gray-800">
                      <h3 className="text-[10px] text-gray-500 mb-4 uppercase tracking-widest font-black">Performance Real (Jogo)</h3>
                      <div className="space-y-2">
                        {/* Linha Coletiva (Escanteios) */}
                        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/50 flex flex-col gap-1">
                          <span className="text-gray-300 font-bold text-xs uppercase">Coletivo</span>
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>Cantos Mandante: <strong className="text-gray-200">{partida.escanteios_mandante || 0}</strong></span>
                            <span>Cantos Visitante: <strong className="text-gray-200">{partida.escanteios_visitante || 0}</strong></span>
                          </div>
                        </div>
                        {/* Linhas Individuais (Props) */}
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
               <p className="text-gray-500 font-semibold uppercase tracking-widest">Amostragem Vazia</p>
               <p className="text-gray-600 text-sm mt-2">Altere os filtros na barra lateral.</p>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}