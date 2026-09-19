import { useEffect, useState } from 'react';
import { getMe } from '../api';

type User = {
  id: number;
  fullName: string;
  email: string;
  createdAt: string;
};

function Profile() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getMe().then(setUser).catch(console.error);
  }, []);

  if (!user) return <div style={{ padding: 24 }}>Завантаження...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Профіль</h1>
      <div style={{ maxWidth: 400, background: '#f8f8f8', padding: 20, borderRadius: 8 }}>
        <p>
          <b>Ім'я:</b> {user.fullName}
        </p>
        <p>
          <b>Email:</b> {user.email}
        </p>
        <p>
          <b>Акаунт створено:</b> {new Date(user.createdAt).toLocaleDateString('uk-UA')}
        </p>
      </div>
    </div>
  );
}

export default Profile;