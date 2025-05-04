import express from 'express';

const app = express();

app.listen(5000, () => {
    console.log('Serwer działa na porcie 5000');
});