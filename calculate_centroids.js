const fs = require('fs');
const path = require('path');

function calculateCentroids() {
    const filePath = path.join(__dirname, 'src/components/NigeriaStatePaths.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    const match = content.match(/const NIGERIA_STATE_PATHS: Record<string, string> = ({[\s\S]*?});/);
    if (!match) {
        console.error("Could not find NIGERIA_STATE_PATHS");
        return;
    }

    const pathsStr = match[1];
    const NIGERIA_STATE_PATHS = {};
    const pathRegex = /"([^"]+)":\s*"([^"]+)"/g;
    let pathMatch;
    while ((pathMatch = pathRegex.exec(pathsStr)) !== null) {
        NIGERIA_STATE_PATHS[pathMatch[1]] = pathMatch[2];
    }

    const centroids = {};

    for (const [state, d] of Object.entries(NIGERIA_STATE_PATHS)) {
        let curX = 0, curY = 0;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        const commands = d.match(/[a-df-z][^a-df-z]*/ig) || [];

        let startX = 0, startY = 0;

        for (const cmd of commands) {
            const type = cmd[0];
            const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

            switch (type) {
                case 'M':
                    for (let i = 0; i < args.length; i += 2) {
                        curX = args[i];
                        curY = args[i + 1];
                        if (i === 0) { startX = curX; startY = curY; }
                        updateBounds(curX, curY);
                    }
                    break;
                case 'm':
                    for (let i = 0; i < args.length; i += 2) {
                        if (i === 0 && startX === 0 && startY === 0) {
                            curX = args[i];
                            curY = args[i + 1];
                            startX = curX; startY = curY;
                        } else {
                            curX += args[i];
                            curY += args[i + 1];
                        }
                        updateBounds(curX, curY);
                    }
                    break;
                case 'L':
                    for (let i = 0; i < args.length; i += 2) {
                        curX = args[i]; curY = args[i + 1];
                        updateBounds(curX, curY);
                    }
                    break;
                case 'l':
                    for (let i = 0; i < args.length; i += 2) {
                        curX += args[i]; curY += args[i + 1];
                        updateBounds(curX, curY);
                    }
                    break;
                case 'H':
                    for (let i = 0; i < args.length; i++) {
                        curX = args[i];
                        updateBounds(curX, curY);
                    }
                    break;
                case 'h':
                    for (let i = 0; i < args.length; i++) {
                        curX += args[i];
                        updateBounds(curX, curY);
                    }
                    break;
                case 'V':
                    for (let i = 0; i < args.length; i++) {
                        curY = args[i];
                        updateBounds(curX, curY);
                    }
                    break;
                case 'v':
                    for (let i = 0; i < args.length; i++) {
                        curY += args[i];
                        updateBounds(curX, curY);
                    }
                    break;
                case 'Z':
                case 'z':
                    curX = startX; curY = startY;
                    break;
            }
        }

        function updateBounds(x, y) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        centroids[state] = {
            x: Math.round((minX + maxX) / 2),
            y: Math.round((minY + maxY) / 2)
        };
    }

    console.log(JSON.stringify(centroids, null, 2));
}

calculateCentroids();
