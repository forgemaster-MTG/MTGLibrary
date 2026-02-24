const start = performance.now();
fetch("http://localhost:3004/api/releases?limit=1")
    .then(r => r.json())
    .then(data => {
        console.log("Time for limit=1 (ms):", performance.now() - start);
        console.log("Data size (bytes):", JSON.stringify(data).length);

        const start2 = performance.now();
        return fetch("http://localhost:3004/api/releases?limit=9&offset=1")
            .then(r => r.json())
            .then(d2 => {
                console.log("Time for limit=9 (ms):", performance.now() - start2);
                console.log("Data size (bytes):", JSON.stringify(d2).length);
            });
    })
    .catch(console.error);
