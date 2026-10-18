
const fs = require('fs');
const selfsigned = require('selfsigned');

async function generateCertificate() {
    const attributes = [
        { name: 'commonName', value: 'localhost' }
    ];

    const options = {
        days: 365,
        keySize: 2048,
        extensions: [
            {
                name: 'subjectAltName',
                altNames: [
                    { type: 2, value: 'localhost' },
                    { type: 7, ip: '127.0.0.1' }
                ]
            }
        ]
    };

    const pems = await selfsigned.generate(attributes, options);

    fs.mkdirSync('ssl', { recursive: true });
    fs.writeFileSync('ssl/key.pem', pems.private);
    fs.writeFileSync('ssl/cert.pem', pems.cert);

    console.log('Sertifikat berhasil dibuat!');
    console.log('File: ssl/key.pem');
    console.log('File: ssl/cert.pem');
}

generateCertificate().catch(console.error);
