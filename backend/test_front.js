const fetch = require('node-fetch');

(async () => {
    try {
        const res = await fetch('http://localhost:8080/product');
        const db = await res.json();
        const p = db[0];

        // test POST upload
        const FormData = require('form-data');
        const fs = require('fs');
        const form = new FormData();
        
        fs.writeFileSync('dummy.jpg', 'dummy content');
        form.append('file', fs.createReadStream('dummy.jpg'));

        console.log("POST /upload ...");
        const uRes = await fetch('http://localhost:8080/upload', {
            method: 'POST',
            body: form
        });
        console.log("Upload status: ", uRes.status);
        const uText = await uRes.text();
        console.log("Upload response: ", uText);

    } catch(e) { console.error(e) }
})();
