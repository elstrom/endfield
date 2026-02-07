import { debugLog } from "./logger";

export interface GridPos {
    x: number;
    y: number;
}

export interface PathNode extends GridPos {
    g: number; // Cost from start
    h: number; // Heuristic (Manhattan distance to end)
    f: number; // Total cost (g + h)
    parent: PathNode | null;
}

export class Pathfinder {
    private occupancyMap: Map<string, any>;
    private worldWidth: number;
    private worldHeight: number;

    constructor(occupancyMap: Map<string, any>, worldWidth: number = 256, worldHeight: number = 256) {
        this.occupancyMap = occupancyMap;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
    }

    private getHeuristic(a: GridPos, b: GridPos): number {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    private getNeighbors(node: GridPos): GridPos[] {
        const neighbors: GridPos[] = [];
        const dirs = [
            { x: 0, y: -1 }, // North
            { x: 1, y: 0 },  // East
            { x: 0, y: 1 },  // South
            { x: -1, y: 0 }  // West
        ];

        for (const dir of dirs) {
            const nx = node.x + dir.x;
            const ny = node.y + dir.y;

            if (nx >= 0 && nx < this.worldWidth && ny >= 0 && ny < this.worldHeight) {
                neighbors.push({ x: nx, y: ny });
            }
        }
        return neighbors;
    }

    private isWalkable(pos: GridPos, end: GridPos): boolean {
        const key = `${pos.x},${pos.y}`;
        const occupant = this.occupancyMap.get(key);

        // Target goal is always walkable to allow snapping
        if (pos.x === end.x && pos.y === end.y) return true;

        if (occupant) {
            // Port cells are walkable ONLY if they are the start/end points of the search
            // (The end check is handled above, but for clarity: we don't allow walking THROUGH other ports)
            if (occupant.port) return false;

            // Existing belts are walkable but with "Bridge" logic handled separately
            // For A* search, we treat them as slightly more expensive or just walkable
            // if we want to allow crossing. 
            // BUT, if it's a solid building footprint (no port), it's BLOCKED.

            const isBelt = occupant.instanceId && this.instanceIsBelt(occupant.instanceId);
            if (isBelt) return true; // Allow crossing belts (will auto-bridge later)

            return false;
        }

        return true;
    }

    private instanceIsBelt(instanceId: string): boolean {
        const pf = (window as any).placedFacilities?.find((f: any) => f.instanceId === instanceId);
        return pf?.facilityId === (window as any).config?.belt_id;
    }

    findPath(start: GridPos, end: GridPos): GridPos[] {
        if (start.x === end.x && start.y === end.y) return [start];

        const openList: PathNode[] = [];
        const closedSet = new Set<string>();

        const startNode: PathNode = {
            ...start,
            g: 0,
            h: this.getHeuristic(start, end),
            f: 0,
            parent: null
        };
        startNode.f = startNode.g + startNode.h;

        openList.push(startNode);

        let iterations = 0;
        const maxIterations = 1000;

        while (openList.length > 0 && iterations < maxIterations) {
            iterations++;

            openList.sort((a, b) => a.f - b.f);
            const current = openList.shift()!;

            if (current.x === end.x && current.y === end.y) {
                return this.reconstructPath(current);
            }

            closedSet.add(`${current.x},${current.y}`);

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const nKey = `${neighbor.x},${neighbor.y}`;
                if (closedSet.has(nKey)) continue;
                if (!this.isWalkable(neighbor, end)) continue;

                // Basic cost 1, but maybe higher if crossing a belt to prefer empty space?
                const occupant = this.occupancyMap.get(nKey);
                const stepCost = (occupant && !occupant.port) ? 2 : 1;

                const gScore = current.g + stepCost;
                let neighborNode = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);

                if (!neighborNode) {
                    neighborNode = {
                        ...neighbor,
                        g: gScore,
                        h: this.getHeuristic(neighbor, end),
                        f: 0,
                        parent: current
                    };
                    neighborNode.f = neighborNode.g + neighborNode.h;
                    openList.push(neighborNode);
                } else if (gScore < neighborNode.g) {
                    neighborNode.g = gScore;
                    neighborNode.f = neighborNode.g + neighborNode.h;
                    neighborNode.parent = current;
                }
            }
        }

        return [];
    }

    private reconstructPath(node: PathNode): GridPos[] {
        const path: GridPos[] = [];
        let curr: PathNode | null = node;
        while (curr) {
            path.push({ x: curr.x, y: curr.y });
            curr = curr.parent;
        }
        return path.reverse();
    }
}
