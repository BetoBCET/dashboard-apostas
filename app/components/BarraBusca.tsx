'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function BarraBusca() {
  const [esporte, setEsporte] = useState('basquete');
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<number | null>(null);

  const buscarDados = async () => {
    if (!termo) return;
    setCarregando(true);
    
    try {
      const res = await fetch(`/api/buscar?esporte=${esporte}&termo=${termo}`);
      const dados = await res.json();
      
      if (dados.sucesso) {
        setResultados(dados.resultados);
      }
    } catch (erro) {
      console.error("Erro na busca", erro);
    } finally {
      setCarregando(false);
    }
  };

  const salvarRastreador = async (item: any) => {
    setSalvando(item.id_externo);
    
    const { error } = await supabase
      .from('rastreadores')
      .insert([
        {
          esporte: esporte,
          id_externo: item.id_externo,
          nome: item.nome,
          detalhes: item.time || item.pais || ''
        }
      ]);

    setSalvando(null);

    if (error) {
      if (error.code === '23505') {
        alert('⚠️ Esse ID já está cadastrado no seu radar!');
      } else {
        alert('❌ Erro ao salvar: ' + error.message);
      }
    } else {
      alert(`✅ ${item.nome} adicionado ao radar com sucesso!`);
    }
  };

  return (
    <div className="bg-[#1e1e24] p-6 rounded-xl border border-gray-800 mb-8">
      <h3 className="text-white font-bold mb-4">Adicionar Novo Rastreador</h3>
      
      <div className="flex gap-4 mb-4">
        <select 
          className="bg-[#121215] text-white p-3 rounded-lg border border-gray-700 outline-none"
          value={esporte} 
          onChange={(e) => setEsporte(e.target.value)}
        >
          <option value="basquete">NBA (Jogadores)</option>
          <option value="futebol">Futebol (Times)</option>
        </select>

        <input 
          type="text" 
          placeholder="Ex: Curry ou Flamengo..." 
          className="flex-1 bg-[#121215] text-white p-3 rounded-lg border border-gray-700 outline-none"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscarDados()}
        />

        <button 
          onClick={buscarDados}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold transition-all"
          disabled={carregando}
        >
          {carregando ? 'Buscando...' : 'Pesquisar'}
        </button>
      </div>

      {resultados.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {resultados.map((item, index) => (
            <div key={index} className="flex justify-between items-center bg-[#121215] p-3 rounded-lg border border-gray-800">
              <span className="text-gray-300 font-medium">
                {item.nome} <span className="text-gray-500 text-sm">({item.time || item.pais})</span>
              </span>
              <button 
                onClick={() => salvarRastreador(item)}
                disabled={salvando === item.id_externo}
                className="bg-gray-700 hover:bg-emerald-600 text-white px-4 py-1 rounded text-sm transition-all disabled:opacity-50"
              >
                {salvando === item.id_externo ? 'Salvando...' : `+ Salvar ID: ${item.id_externo}`}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}