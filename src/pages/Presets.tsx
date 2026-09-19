import { useEffect, useState } from 'react';
import { getPresets, createPreset, deletePreset } from '../api';

type SavedPreset = {
  id: number;
  name: string;
  soundType: string;
};

const SOUND_TYPES = [
  { id: 'ambient', name: 'Ембіентний пад' },
  { id: 'lead', name: 'Яскравий лід' },
  { id: 'soft', name: "М'який трикутник" },
];

function Presets() {
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [name, setName] = useState('');
  const [soundType, setSoundType] = useState(SOUND_TYPES[0].id);

  const load = async () => {
    try {
      const data = await getPresets();
      setPresets(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Введи назву пресету');
      return;
    }
    try {
      await createPreset(name, soundType);
      setName('');
      load();
    } catch (error) {
      console.error(error);
      alert('Не вдалось створити пресет');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePreset(id);
      load();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUseInSession = (type: string) => {
    localStorage.setItem('selectedSoundType', type);
    alert('Пресет обрано — відкрий "Грати", щоб почути');
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Мої пресети</h1>
      <p style={{ color: '#666' }}>Збережи власні набори налаштувань звуку і використовуй їх під час гри.</p>

      <div style={{ display: 'flex', gap: 8, margin: '20px 0', maxWidth: 500 }}>
        <input
          type="text"
          placeholder="Назва пресету"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <select
          value={soundType}
          onChange={(e) => setSoundType(e.target.value)}
          style={{ padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
        >
          {SOUND_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleCreate}
          style={{ padding: '10px 16px', background: '#4DC9B0', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          + Створити
        </button>
      </div>

      {presets.length === 0 && <p style={{ color: '#888' }}>Ще нема збережених пресетів</p>}

      <div style={{ maxWidth: 600 }}>
        {presets.map((preset) => (
          <div
            key={preset.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#f8f8f8',
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <span>
              <b>{preset.name}</b>{' '}
              <span style={{ color: '#888', fontSize: 12 }}>
                ({SOUND_TYPES.find((t) => t.id === preset.soundType)?.name || preset.soundType})
              </span>
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleUseInSession(preset.soundType)} style={{ cursor: 'pointer' }}>
                Використати
              </button>
              <button onClick={() => handleDelete(preset.id)} style={{ cursor: 'pointer', color: 'red' }}>
                Видалити
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Presets;