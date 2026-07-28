"use client";

import BarraBusca from './components/BarraBusca';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Tabela de Odds médias para a simulação de Backtest fluir perfeita
const ODD_PADRAO: Record<string, number> = {
  'Over 1.5': 1.30,
  'Over 2.5': 1.85,
  'Over 3.5': 2.80,
  'Ambas Marcam': 1.75,
  'Over 0.5 HT': 1.40,
  'Over 1.5 HT': 2.60,
  'Resultado Final': 1.90 
};

export default function Home() {
  const [partidas, setPartidas] = useState<any[]>([]);
  const [timeSelecionado, setTimeSelecionado] = useState('Todos');
  const [mercadoSelecionado, setMercadoSelecionado] = useState('Over 2.5'); // Mercado Ativo
  const [carregando, setCarregando] = useState(false);
  const [alvosCadastrados, setAlvosCadastrados] = useState<any[]>([]);
  const [apiRestante, setApiRestante] = useState<string | number>('--');

  // =========================================================================
  // MOTOR DE CÁLCULO LOCAL (Instantâneo, Custo API: Zero)
  // =========================================================================
  const verificarResultado = (mercado: string, partida: any) => {
    const totalGols = (partida.gols_mandante || 0) + (partida.gols_visitante || 0);
    const totalGolsHT = (partida.gols_mandante_ht || 0) + (partida.gols_visitante_ht || 0);

    if (mercado === 'Over 1.5') return totalGols > 1.5 ? 'GREEN' : 'RED';
    if (mercado === 'Over 2.5') return totalGols > 2.5 ? 'GREEN' : 'RED';
    if (mercado === 'Over 3.5') return totalGols > 3.5 ? 'GREEN' : 'RED';
    
    if (mercado === 'Ambas Marcam') {
      const ambas = (partida.gols_mandante || 0) > 0 && (partida.gols_visitante || 0) > 0;
      return ambas ? 'GREEN' : 'RED';
    }

    if (mercado === 'Over 0.5 HT') return totalGolsHT > 0.5 ? 'GREEN' : 'RED';
    if (mercado === 'Over 1.5 HT') return totalGolsHT > 1.5 ? 'GREEN' : 'RED';

    if (mercado === 'Resultado Final') {
      // Para backtest simplificado, assume vitória do mandante como Green base
      return partida.gols_mandante > partida.gols_visitante ? 'GREEN' : 'RED';
    }

    return 'PENDENTE';
  };

  const calcularEstatisticas = () => {
    let greens = 0, reds = 0, lucroAtual = 0;
    let sequencia: string[] = []; 
    let historicoBanca: number[] = [0]; 
    const oddMedia = ODD_PADRAO[mercadoSelecionado] || 1.85;

    [...partidas].reverse().forEach(partida => {
      const resultado = verificarResultado(mercadoSelecionado, partida);
      if (resultado === 'GREEN') { 
        greens++; 
        lucroAtual += (oddMedia - 1); 
        sequencia.push('GREEN'); 
      } else if (resultado === 'RED') { 
        reds++; 
        lucroAtual -= 1; 
        sequencia.push('RED'); 
      }
      historicoBanca.push(parseFloat(lucroAtual.toFixed(2)));
    });

    const totalInvestido = greens + reds;
    return { 
      greens, reds, 
      taxaAcerto: totalInvestido > 0 ? ((greens / totalInvestido) * 100).toFixed(1) : '0.0', 
      lucroUnidades: lucroAtual.toFixed(2), 
      roi: totalInvestido > 0 ? ((lucroAtual / totalInvestido) * 100).toFixed(1) : '0.0', 
      totalInvestido, sequencia, historicoBanca, oddMedia 
    };
  };

  const stats = calcularEstatisticas();
  const maxLucro = Math.max(...stats.historicoBanca, 1);
  const minLucro = Math.min(...stats.historicoBanca, 0);
  const amplitude = maxLucro - minLucro || 1;

  // Carrega os alvos do banco ao abrir a tela
  useEffect(() => {
    async function carregarAlvos() {
      const { data } = await supabase.from('rastreadores').select('*');
      if (data) setAlvosCadastrados(data);
    }
    carregarAlvos();
  }, []);

  // Busca na API/Banco (Só acontece ao apertar o botão verde)
  async function buscarDados() {
    setCarregando(true);
    const alvo = alvosCadastrados.find(a => a.nome === timeSelecionado);
    
    if (!alvo || timeSelecionado === 'Todos') {
      alert("⚠️ Selecione um time na lateral.");
      setCarregando(false);
      return;
    }

    try {
      const resposta = await fetch(`/api/processar?id=${alvo.id_externo}&categoria=${alvo.esporte}`);
      const dados = await resposta.json();
      
      if (dados.sucesso) {
        setPartidas(dados.partidas); // Joga os jogos brutos na tela
        if (dados.apiRestante) setApiRestante(dados.apiRestante);
      } else {
        alert("Erro no servidor: " + dados.erro);
      }
    } catch (error) {
      console.error("Erro de conexão", error);
    }
    setCarregando(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex font-sans">
      <aside className="w-72 bg-gray-900 border-r border-gray-800 p-6 flex flex-col h-screen sticky top-0">
        <h2 className="text-xl font-black text-emerald-400 mb-8 border-b border-gray-800 pb-4">Backtest<span className="text-white">PRO</span></h2>
        
        <div className="space-y-6 mb-8">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">1. Escolha o Alvo</label>
            <select value={timeSelecionado} onChange={(e) => setTimeSelecionado(e.target.value)} className="w-full bg-gray-950 border border-gray-800 text-gray-300 text-sm rounded-lg p-3 outline-none">
              <option value="Todos">-- Lista de Rastreadores --</option>
              {alvosCadastrados.map((alvo) => (
                <option key={alvo.id} value={alvo.nome}>{alvo.nome}</option>
              ))}
            </select>
          </div>
          
          <button onClick={buscarDados} disabled={carregando} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            {carregando ? 'BAIXANDO DADOS...' : 'PROCESSAR ALVO'}
          </button>

          <div className="pt-4 border-t border-gray-800">
            <label className="block text-xs font-bold text-emerald-500 uppercase mb-2">2. Filtro Interativo (Sem custo)</label>
            <select value={mercadoSelecionado} onChange={(e) => setMercadoSelecionado(e.target.value)} className="w-full bg-gray-950 border border-emerald-900/50 text-gray-200 text-sm rounded-lg p-3 outline-none focus:border-emerald-500 transition-all">
              <option value="Over 0.5 HT">Gols: Over 0.5 HT</option>
              <option value="Over 1.5 HT">Gols: Over 1.5 HT</option>
              <option value="Over 1.5">Gols: Over 1.5 FT</option>
              <option value="Over 2.5">Gols: Over 2.5 FT</option>
              <option value="Over 3.5">Gols: Over 3.5 FT</option>
              <option value="Ambas Marcam">Gols: Ambas Marcam (BTTS)</option>
              <option value="Resultado Final">Match Odds (1X2)</option>
            </select>
            <p className="text-[10px] text-gray-500 mt-2 text-center">O gráfico atualiza instantaneamente.</p>
          </div>
        </div>

        <div className="mt-auto text-center border-t border-gray-800 pt-4">
          <p className="text-[10px] text-gray-500 uppercase font-bold">Cota Diária da API</p>
          <p className="text-2xl font-black text-white mt-1">{apiRestante}</p>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-black text-gray-100 mb-2">Desempenho Estratégico</h1>
          <p className="text-gray-400 text-sm mb-6">Mercado Analisado: <strong className="text-emerald-400">{mercadoSelecionado}</strong> | Odd Média de Simulação: <strong className="text-emerald-400">@{stats.oddMedia.toFixed(2)}</strong></p>
          
          <BarraBusca />

          <div className="grid grid-cols-4 gap-4 mb-10">
            <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl flex flex-col justify-center">
              <p className="text-gray-500 text-xs font-bold uppercase mb-2">Win Rate Global</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-white">{stats.taxaAcerto}%</p>
                <span className="text-[10px] text-gray-500 bg-gray-950 px-2 py-0.5 rounded-full border border-gray-800">{stats.greens}G / {stats.reds}R</span>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl flex flex-col justify-center">
               <p className="text-gray-500 text-xs font-bold uppercase mb-2">Lucro Projetado</p>
               <p className={`text-3xl font-black ${parseFloat(stats.lucroUnidades) > 0 ? 'text-emerald-400' : parseFloat(stats.lucroUnidades) < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                 {parseFloat(stats.lucroUnidades) > 0 ? '+' : ''}{stats.lucroUnidades} U
               </p>
            </div>
            
            <div className="col-span-2 bg-gray-900 border border-gray-800 p-5 rounded-2xl flex flex-col">
              <p className="text-gray-500 text-xs font-bold uppercase mb-4">Curva de Capital</p>
              <div className="flex-1 flex items-end gap-1 h-16 w-full relative border-b border-gray-800">
                <div className="absolute w-full border-t border-dashed border-gray-700" style={{ bottom: `${(Math.abs(minLucro) / amplitude) * 100}%` }}></div>
                {stats.historicoBanca.map((valor, idx) => {
                  const percentual = ((valor - minLucro) / amplitude) * 100;
                  return <div key={idx} className={`flex-1 w-full max-w-[20px] rounded-t-sm transition-all ${valor >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ height: `${percentual}%`, minHeight: '4px' }}></div>;
                })}
              </div>
            </div>
          </div>
        </header>

        <div className="w-full space-y-4">
          {partidas.length > 0 ? partidas.map((partida) => {
            const resultado = verificarResultado(mercadoSelecionado, partida);
            const cor = resultado === 'GREEN' ? 'border-emerald-500/30 bg-emerald-950/10' : resultado === 'RED' ? 'border-red-500/30 bg-red-950/10' : 'border-gray-800 bg-gray-900';
            
            return (
              <div key={partida.id} className={`border rounded-xl p-5 flex justify-between items-center transition-all ${cor}`}>
                <div className="flex flex-col w-1/4">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">{partida.campeonatos.nome}</span>
                  <span className="text-xs text-gray-400">{new Date(partida.data_jogo).toLocaleDateString('pt-BR')}</span>
                </div>

                <div className="flex items-center gap-6 w-2/4 justify-center">
                  <span className="font-bold text-sm text-right w-1/3">{partida.mandante.nome}</span>
                  <div className="bg-gray-950 px-4 py-2 rounded-lg border border-gray-800 font-black text-xl min-w-[80px] text-center">
                    {partida.gols_mandante} - {partida.gols_visitante}
                  </div>
                  <span className="font-bold text-sm text-left w-1/3">{partida.visitante.nome}</span>
                </div>

                <div className="w-1/4 flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 font-bold uppercase mb-1">Status na Linha</span>
                  <span className={`font-black text-sm px-3 py-1 rounded ${resultado === 'GREEN' ? 'text-emerald-400 bg-emerald-900/30' : 'text-red-400 bg-red-900/30'}`}>
                    {resultado}
                  </span>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-gray-900/30">
              <p className="text-gray-500 font-semibold uppercase">Pronto para Análise</p>
              <p className="text-xs text-gray-600 mt-2">Escolha o time, clique em Processar Alvo e utilize os filtros para explorar as linhas.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}