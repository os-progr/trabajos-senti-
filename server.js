const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Asegurar que existe el directorio de subidas
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configuración de Base de Datos
const db = new sqlite3.Database('./tasks.db', (err) => {
    if (err) {
        console.error('Error abriendo la base de datos', err);
    } else {
        console.log('Conectado a la base de datos SQLite.');
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT,
            description TEXT,
            filename TEXT,
            original_name TEXT,
            mimetype TEXT,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Configurar Multer para subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const extension = path.extname(file.originalname);
        cb(null, uniqueId + extension);
    }
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

// API: Subir una tarea
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo' });
    }

    const taskId = uuidv4();
    const { title, description } = req.body;
    const { filename, originalname, mimetype } = req.file;

    db.run(
        `INSERT INTO tasks (id, title, description, filename, original_name, mimetype) VALUES (?, ?, ?, ?, ?, ?)`,
        [taskId, title || 'Sin Título', description || '', filename, originalname, mimetype],
        function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error en la base de datos' });
            }
            res.json({ success: true, taskId, link: `/task.html?id=${taskId}` });
        }
    );
});

// API: Obtener detalles de tarea
app.get('/api/task/:id', (req, res) => {
    const taskId = req.params.id;
    db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error en la base de datos' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }
        res.json(row);
    });
});

// Ruta para servir archivos de manera directa
app.get('/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Archivo no encontrado');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
