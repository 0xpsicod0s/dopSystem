import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import path from 'path';
import compression from 'compression';
import helmet from 'helmet';
import xss from 'xss-clean';
import csurf from 'csurf';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/routes.js';
import frontEndRoutes from './routes/frontEndRoutes.js';

const app = express();
const csrfProtection = csurf({ cookie: true });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(xss());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://code.jquery.com", "'sha256-hicaDpG/oBO5QMFpUBv/tbDg6C4kG74iU8mEP2+HH5o='"],
            imgSrc: ["'self'", "data:", "https://www.habbo.com.br"]
        },
    }
}));
app.use(csrfProtection, (req, res, next) => {
    res.cookie('XSRFTOKEN', req.csrfToken());
    next();
});

mongoose.connect(process.env.MONGODB_URL)
.then(() => app.emit('mongodbConnect'))
.catch(e => console.log('Erro ao conectar ao MongoDB: ', e));

app.use('/', frontEndRoutes);
app.use('/api/', apiRoutes);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.on('mongodbConnect', function() {
    app.listen(PORT, function () {
        console.log('Servidor iniciado');
    });
});