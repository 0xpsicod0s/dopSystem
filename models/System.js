import mongoose from 'mongoose';
import sanitize from 'sanitize-html';
import { RegisterModel } from './Register.js';
import { saveLog } from '../controllers/logController.js';

const SystemSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['publicacao', 'documento']
    },
    title: { type: String, required: true },
    applicant: { type: String, required: true },
    date: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed, required: true },
    link: { type: String, required: true }
});

export const SystemModel = mongoose.model('System', SystemSchema);

export class System {
    constructor(req, res) {
        this.req = req;
        this.res = res;
    }

    async createRequirement(type, title, applicant, details, link) {
        if (!type || !title || !applicant || !details || !link) {
            throw new Error('Todos os campos são obrigatórios');
        }

        const newRequirement = new SystemModel({
            type,
            title,
            applicant,
            details,
            link
        });
        await newRequirement.save();
        return newRequirement;
    }

    cleanHtml(content) {
        return sanitize(content, {
            allowedTags: sanitize.defaults.allowedTags.concat(['img']),
            allowedAttributes: {
                '*': ['style', 'class'],
                'a': ['href', 'name', 'target'],
                'img': ['src']
            },
            allowedSchemes: ['http', 'https', 'ftp', 'mailto'],
            allowedSchemesByTag: {
                'img': ['data']
            }
        });
    }

    formatTitleForLink(title) {
        let formattedTitle = title.toLowerCase();    
        formattedTitle = formattedTitle.replace(/\s+/g, '_');    
        formattedTitle = formattedTitle.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return formattedTitle;
    }

    async getPublications() {
        try {
            const publications = await SystemModel.find({ type: 'publicacao' });
            if (!publications.length) return this.res.status(404).json({ error: 'Não há publicações postadas' });

            return this.res.status(200).json(publications);
        } catch (err) {
            return this.res.status(500).json({ error: 'Houve um erro interno. Contate um desenvolvedor' });
        }
    }

    async getPublication() {
        const { pubId } = this.req.params;
        if (!pubId) return this.res.status(400).json({ error: 'ID não especificado' });

        try {
            const publication = await SystemModel.findOne({ _id: pubId });
            if (!publication) return this.res.status(404).json({ error: 'Não foi possivel encontrar a publicação desejada' });

            return this.res.status(200).json(publication);
        } catch (err) {
            return this.res.status(500).json({ error: 'Houve um erro interno. Contate um desenvolvedor' });
        }
    }

    async addPublication() {
        const { title, content } = this.req.body;
        if (!title || !content) return this.res.status(400).json({ error: 'Preencha todos os campos' });

        try {
            const publisher = await RegisterModel.findById({ _id: this.req.userId }).select('nickname');
            if (!publisher) return this.res.status(403).json({ error: 'Você não tem permissão para isso' });

            const formattedTitle = this.formatTitleForLink(title);
            
            await this.createRequirement('publicacao', title, publisher.nickname, this.cleanHtml(content), formattedTitle);
            await saveLog(publisher.nickname, 'ADD_PUB', `${publisher.nickname} adicionou uma nova publicação`, this.req);
            return this.res.status(201).json({ success: 'Nova publicação adicionada com sucesso!' });
        } catch (err) {
            return this.res.status(500).json({ error: 'Houve um erro interno. Contate um desenvolvedor' });
        }
    }

    async editPublication() {
        const { pubId } = this.req.params;
        if (!pubId) return this.res.status(400).json({ error: 'ID não especificado' });

        const { title, content } = this.req.body;
        if (!title || !content) return this.res.status(400).json({ error: 'Preencha todos os campos' });

        try {
            const editor = await RegisterModel.findById({ _id: this.req.userId }).select('nickname');
            if (!editor) return this.res.status(403).json({ error: 'Você não tem permissão para isso' });

            const updateFields = {};
            if (title) updateFields.title = title;
            if (content) updateFields.details = this.cleanHtml(content);

            if (Object.keys(updateFields).length === 0) {
                return this.res.status(400).json({ error: 'Nenhum campo para atualizar' });
            }

            const publicationUpdated = await SystemModel.updateOne(
                { _id: pubId },
                { $set: updateFields }
            );
            if (publicationUpdated.matchedCount === 0) {
                return this.res.status(404).json({ error: 'Publicação não encontrada' });
            }

            await saveLog(editor.nickname, 'EDIT_PUB', `${editor.nickname} editou uma publicação`, this.req);
            return this.res.status(200).json({ success: 'Publicação atualizada com sucesso!' });
        } catch (err) {
            return this.res.status(500).json({ error: 'Houve um erro interno. Contate um desenvolvedor' });
        }
    }

    async deletePublication() {
        const { pubId } = this.req.params;
        if (!pubId) return this.res.status(400).json({ error: 'ID não especificado' });

        try {
            const pubDeleted = await SystemModel.deleteOne({ _id: pubId });
            if (pubDeleted.deletedCount === 0) return this.res.status(404).json({ error: 'Publicação não encontrada' });

            return this.res.status(200).json({ success: 'Publicação deletada com sucesso!' });
        } catch (err) {
            return this.res.status(500).json({ error: 'Houve um erro interno. Contate um desenvolvedor' });
        }
    }

    async getDocuments() {
        try {
            const documents = await SystemModel.find({ type: 'documento' });
            if (!documents.length) return this.res.status(404).json({ error: 'Não há documentos postados' });

            return this.res.status(200).json(documents);
        } catch (err) {
            return this.res.status(500).json({ error: 'Houve um erro interno. Contate um desenvolvedor' });
        }
    }

    async getDocument() {
        const { docId } = this.req.params;
        if (!docId) return this.res.status(400).json({ error: 'ID não especificado' });

        try {
            const document = await SystemModel.findOne({ _id: docId });
            if (!document) return this.res.status(404).json({ error: 'Não foi possivel encontrar o documento desejada' });

            return this.res.status(200).json(document);
        } catch (err) {
            return this.res.status(500).json({ error: 'Houve um erro interno. Contate um desenvolvedor' });
        }
    }

    async addDocument() {
        const { title, content } = this.req.body;
        if (!title || !content) return this.res.status(400).json({ error: 'Preencha todos os campos' });

        try {
            const publisher = await RegisterModel.findById({ _id: this.req.userId }).select('nickname');
            if (!publisher) return this.res.status(403).json({ error: 'Você não tem permissão para isso' });
            
            const formattedTitle = this.formatTitleForLink(title);

            await this.createRequirement('documento', title, publisher.nickname, this.cleanHtml(content), formattedTitle);
            await saveLog(publisher.nickname, 'ADD_DOC', `${publisher.nickname} adicionou um novo documento`, this.req);
            return this.res.status(201).json({ success: 'Novo documento adicionado com sucesso!' });
        } catch (err) {
            return this.res.status(500).json({ error: 'Houve um erro interno. Contate um desenvolvedor' });
        }
    }

    async editDocument() {
        const { docId } = this.req.params;
        if (!docId) return this.res.status(400).json({ error: 'ID não especificado' });

        const { title, content } = this.req.body;
        if (!title || !content) return this.res.status(400).json({ error: 'Preencha todos os campos' });

        try {
            const editor = await RegisterModel.findById({ _id: this.req.userId }).select('nickname');
            if (!editor) return this.res.status(403).json({ error: 'Você não tem permissão para isso' });

            const updateFields = {};
            if (title) updateFields.title = title;
            if (content) updateFields.details = this.cleanHtml(content);

            if (Object.keys(updateFields).length === 0) {
                return this.res.status(400).json({ error: 'Nenhum campo para atualizar' });
            }

            const documentUpdated = await SystemModel.updateOne(
                { _id: docId },
                { $set: updateFields }
            );
            if (documentUpdated.matchedCount === 0) {
                return this.res.status(404).json({ error: 'Documento não encontrado' });
            }

            await saveLog(editor.nickname, 'EDIT_DOC', `${editor.nickname} editou um documento global`, this.req);
            return this.res.status(200).json({ success: 'Documento atualizado com sucesso!' });
        } catch (err) {
            return this.res.status(500).json({ error: 'Houve um erro interno. Contate um desenvolvedor' });
        }
    }

    async deleteDocument() {
        const { docId } = this.req.params;
        if (!docId) return this.res.status(400).json({ error: 'ID não especificado' });

        try {
            const docDeleted = await SystemModel.deleteOne({ _id: docId });
            if (docDeleted.deletedCount === 0) return this.res.status(404).json({ error: 'Documento não encontrado' });

            return this.res.status(200).json({ success: 'Documento deletado com sucesso!' });
        } catch (err) {
            return this.res.status(500).json({ error: 'Houve um erro interno. Contate um desenvolvedor' });
        }
    }
}