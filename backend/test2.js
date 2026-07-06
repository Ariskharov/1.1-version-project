
(async () => {
    try {
        console.log("Fetching products...");
        const res1 = await fetch('http://localhost:8080/product');
        const products = await res1.json();
        console.log(`Found ${products.length} products`);
        const first = products[0];
        
        console.log("Updating product " + first.id);
        const res2 = await fetch('http://localhost:8080/product/' + first.id, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({...first, img: '/test/test.png'})
        });
        
        console.log("PUT status: " + res2.status);
        const out = await res2.text();
        console.log("PUT response: " + out);

        // Try POSTting a new product
        const res3 = await fetch('http://localhost:8080/product', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                id: products.length + 10,
                title: 'Новая мебель 2',
                img: '',
                price: '',
                variables: [],
                conditions: [],
                details: []
            })
        });
        console.log("POST status: " + res3.status);
        const out3 = await res3.text();
        console.log("POST response: " + out3);
        
    } catch (e) {
        console.error(e);
    }
})();
