// Synthetic child for containment tests; terminated by its parent deadline.
process.once('message', ({ format }) => {
    if (format === 'cpu') { while (true) { Math.sqrt(Math.random()); } }
    if (format === 'oversized') process.send({ text: 'x'.repeat(4 * 1024 * 1024 + 1) });
    if (format === 'crash') process.exit(1);
});
