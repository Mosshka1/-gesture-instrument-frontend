import { useEffect, useState } from 'react';
import { getRecordings, deleteRecording, API_BASE_URL } from '../api';

type Recording = {
  id: number;
  name: string;
  fileName: string;
  createdAt: string;
};

function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);

  const load = async () => {
    try {
      const data = await getRecordings();
      setRecordings(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteRecording(id);
      load();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Мої записи</h1>
      <p style={{ color: '#666' }}>
        Тут з'являються мелодії, які ти записала на сторінці "Грати".
      </p>

      {recordings.length === 0 && <p style={{ color: '#888' }}>Ще нема жодного запису</p>}

      <div style={{ maxWidth: 600 }}>
        {recordings.map((rec) => (
          <div
            key={rec.id}
            style={{
              padding: 16,
              background: '#f8f8f8',
              borderRadius: 8,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>{rec.name}</b>
              <span style={{ fontSize: 12, color: '#888' }}>
                {new Date(rec.createdAt).toLocaleString('uk-UA')}
              </span>
            </div>
            <audio controls src={`${API_BASE_URL}/uploads/${rec.fileName}`} style={{ width: '100%' }} />
            <button
              onClick={() => handleDelete(rec.id)}
              style={{ marginTop: 8, cursor: 'pointer', color: 'red', background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '6px 12px' }}
            >
              Видалити
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Recordings;