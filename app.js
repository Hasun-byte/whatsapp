const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode'); // Menggunakan qrcode untuk Base64 QR
const app = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Deklarasi global untuk QR Code dan Client
let qrCodeData = null;
let isClientReady = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
    },
});

client.on('qr', (qr) => {
    console.log('QR Code generated:', qr);
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('Error generating QR Code URL:', err);
        } else {
            qrCodeData = url;
            console.log('QR Code saved successfully.');
        }
    });
});

client.on('ready', () => {
    console.log('Client is ready!');
    isClientReady = true;
});

client.on('disconnected', () => {
    console.log('Client disconnected');
    isClientReady = false;
});

client.initialize();

app.post('/send-message', async (req, res) => {
    let { nohp, pesan, foto } = req.body;

    if (!nohp || !pesan) {
        return res.status(400).json({ status: 'error', pesan: 'No HP dan pesan harus disertakan.' });
    }

    try {
        if (nohp.startsWith('0')) {
            nohp = '62' + nohp.slice(1);
        } else if (!nohp.startsWith('62')) {
            nohp = '62' + nohp;
        }

        nohp = nohp + '@c.us';

        const isRegistered = await client.isRegisteredUser(nohp);

        if (isRegistered) {
            await client.sendMessage(nohp, pesan);

            if (foto) {
                const media = new MessageMedia('image/jpeg', foto.split(';base64,').pop());
                await client.sendMessage(nohp, media, { caption: pesan });
            }

            res.json({ status: 'Berhasil Kirim', pesan });
        } else {
            res.status(404).json({ status: 'Gagal', pesan: 'Nomor Tidak Terdaftar di WhatsApp' });
        }
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ status: 'error', pesan: 'Terjadi kesalahan server' });
    }
});

app.get('/get-qr', (req, res) => {
    console.log('Endpoint /get-qr diakses');
    if (qrCodeData) {
        res.json({ success: true, qrCode: qrCodeData });
    } else {
        res.json({ success: false, message: 'QrCode Belum Siap' });
    }
});

app.get('/client-status', (req, res) => {
    if (isClientReady) {
        res.json({ status: 'ready', success: true, message: 'Client is ready' });
    } else if (qrCodeData === null) {
        res.json({ status: 'waitingQR', success: false, message: 'Waiting for QR Code' });
    } else {
        res.json({ status: 'qrAvailable', success: false, message: 'QR Code is available' });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
