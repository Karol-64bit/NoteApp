const express = require('express');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require("cors");

const app = express();
const PORT = 3000;

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, userId INTEGER, FOREIGN KEY(userId) REFERENCES users(id))');
});

app.use(express.json());
app.use(cors());


// Middleware JWT token
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

// Endpoint register
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (row) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

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

// Endpoint login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    bcrypt.compare(password, row.password, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (!result) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ username: row.username }, 'secret_key');

      res.status(200).json({ token });
    });
  });
});

// Endpoint get notes
app.get('/notes', authenticateToken, (req, res) => {
  const { username } = req.user;

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = row.id;

    db.all('SELECT * FROM notes WHERE userId = ?', [userId], (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      res.status(200).json({ notes: rows });
    });
  });
});

// Endpoint post note
app.post('/notes', authenticateToken, (req, res) => {
  const { username } = req.user;
  const { title, content } = req.body;

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = row.id;


    db.run('INSERT INTO notes (title, content, userId) VALUES (?, ?, ?)', [title, content, userId], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      res.status(201).json({ message: 'Note added successfully' });
    });
  });
});

// Endpoint edit note
app.put('/notes/:id', authenticateToken, (req, res) => {
  const { username } = req.user;
  const { id } = req.params;
  const { title, content } = req.body;

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = row.id;

    db.get('SELECT * FROM notes WHERE id = ? AND userId = ?', [id, userId], (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Note not found' });
      }

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

// Endpoint delete note
app.delete('/notes/:id', authenticateToken, (req, res) => {
  const { username } = req.user;
  const { id } = req.params;

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = row.id;

    db.get('SELECT * FROM notes WHERE id = ? AND userId = ?', [id, userId], (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Note not found' });
      }

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


// Run serwer
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
