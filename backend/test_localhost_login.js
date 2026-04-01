async function testVercel() {
    try {
        console.log('Testing Arif...');
        const resArif = await fetch('http://localhost:8080/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'arif', password: '0000' })
        });
        const textArif = await resArif.text();
        console.log('Arif status:', resArif.status, 'Response:', textArif);
    } catch (e) {
        console.error('Arif error:', e);
    }

    try {
        console.log('Testing Emir...');
        const resEmir = await fetch('http://localhost:8080/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'emir', password: '1234' })
        });
        const textEmir = await resEmir.text();
        console.log('Emir status:', resEmir.status, 'Response:', textEmir);
    } catch (e) {
        console.error('Emir error:', e);
    }
}

testVercel();
