const express = require('express');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require("cors");

const app = express();
const PORT = 3000;

// Konfiguracja bazy danych SQLite
const db = new sqlite3.Database('./database.sqlite');

// Inicjalizacja tabeli użytkowników
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, userId INTEGER, FOREIGN KEY(userId) REFERENCES users(id))');
});

app.use(express.json());
app.use(cors());

// Endpoint rejestracji użytkownika
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  // Sprawdzenie, czy użytkownik o podanej nazwie nie istnieje już w bazie danych
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (row) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Haszowanie hasła przed zapisem do bazy danych
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      // Zapisanie nowego użytkownika do bazy danych
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.status(201).json({ message: 'User registered successfully' });
      });
    });
  });
});

// Endpoint logowania użytkownika
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Pobranie użytkownika o podanej nazwie z bazy danych
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Porównanie hasła wprowadzonego przez użytkownika z hasłem w bazie danych
    bcrypt.compare(password, row.password, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (!result) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generowanie JWT tokena
      const token = jwt.sign({ username: row.username }, 'secret_key');

      res.status(200).json({ token });
    });
  });
});

// Middleware do weryfikacji JWT tokena
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, 'secret_key', (err, user) => {
    if (err) {
      console.error(err);
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = user;
    next();
  });
};

// Endpoint chroniony JWT tokenem
app.get('/protected', authenticateToken, (req, res) => {
  res.status(200).json({ message: 'Protected endpoint' });
});

// Endpoint pobierania notatek użytkownika
app.get('/notes', authenticateToken, (req, res) => {
  const { username } = req.user;

  // Pobranie ID użytkownika na podstawie nazwy użytkownika
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = row.id;

    // Pobranie notatek dla danego użytkownika
    db.all('SELECT * FROM notes WHERE userId = ?', [userId], (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      res.status(200).json({ notes: rows });
    });
  });
});

// Endpoint dodawania notatki dla użytkownika
app.post('/notes', authenticateToken, (req, res) => {
  const { username } = req.user;
  const { title, content } = req.body;

  // Pobranie ID użytkownika na podstawie nazwy użytkownika
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = row.id;

    // Dodanie nowej notatki do bazy danych
    db.run('INSERT INTO notes (title, content, userId) VALUES (?, ?, ?)', [title, content, userId], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      res.status(201).json({ message: 'Note added successfully' });
    });
  });
});

// Endpoint edycji notatki użytkownika
app.put('/notes/:id', authenticateToken, (req, res) => {
  const { username } = req.user;
  const { id } = req.params;
  const { title, content } = req.body;

  // Pobranie ID użytkownika na podstawie nazwy użytkownika
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = row.id;

    // Sprawdzenie, czy notatka należy do danego użytkownika
    db.get('SELECT * FROM notes WHERE id = ? AND userId = ?', [id, userId], (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Aktualizacja notatki w bazie danych
      db.run('UPDATE notes SET title = ?, content = ? WHERE id = ?', [title, content, id], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.status(200).json({ message: 'Note updated successfully' });
      });
    });
  });
});

// Endpoint usuwania notatki użytkownika
app.delete('/notes/:id', authenticateToken, (req, res) => {
  const { username } = req.user;
  const { id } = req.params;

  // Pobranie ID użytkownika na podstawie nazwy użytkownika
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = row.id;

    // Sprawdzenie, czy notatka należy do danego użytkownika
    db.get('SELECT * FROM notes WHERE id = ? AND userId = ?', [id, userId], (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Usunięcie notatki z bazy danych
      db.run('DELETE FROM notes WHERE id = ?', [id], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.status(200).json({ message: 'Note deleted successfully' });
      });
    });
  });
});


// Uruchomienie serwera
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
