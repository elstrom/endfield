import { describe, test, expect } from "vitest";
import { solveLinearSystem } from "@/lib/linear-solver";

describe("Linear System Solver", () => {
  test("solves simple 2x2 system", () => {
    // System: 2x + 3y = 8
    //         4x - y = 2
    // Solution: x = 1, y = 2
    const matrix = [
      [2, 3],
      [4, -1],
    ];
    const constants = [8, 2];

    const solution = solveLinearSystem(matrix, constants);

    expect(solution).not.toBeNull();
    expect(solution![0]).toBeCloseTo(1, 5);
    expect(solution![1]).toBeCloseTo(2, 5);
  });

  test("solves 3x3 system", () => {
    // System: x + y + z = 6
    //         2x - y + 3z = 12
    //         x + 2y - z = 1
    // Solution: x = 2, y = 1, z = 3
    const matrix = [
      [1, 1, 1],
      [2, -1, 3],
      [1, 2, -1],
    ];
    const constants = [6, 12, 1];

    const solution = solveLinearSystem(matrix, constants);

    expect(solution).not.toBeNull();
    expect(solution![0]).toBeCloseTo(2, 5);
    expect(solution![1]).toBeCloseTo(1, 5);
    expect(solution![2]).toBeCloseTo(3, 5);
  });

  test("returns null for singular matrix", () => {
    // Singular matrix (rows are linearly dependent)
    const matrix = [
      [1, 2],
      [2, 4],
    ];
    const constants = [3, 6];

    const solution = solveLinearSystem(matrix, constants);

    expect(solution).toBeNull();
  });

  test("returns null for inconsistent system", () => {
    // Inconsistent system (no solution)
    const matrix = [
      [1, 2],
      [2, 4],
    ];
    const constants = [3, 7];

    const solution = solveLinearSystem(matrix, constants);

    expect(solution).toBeNull();
  });

  test("handles identity matrix", () => {
    const matrix = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const constants = [5, 10, 15];

    const solution = solveLinearSystem(matrix, constants);

    expect(solution).not.toBeNull();
    expect(solution![0]).toBeCloseTo(5, 5);
    expect(solution![1]).toBeCloseTo(10, 5);
    expect(solution![2]).toBeCloseTo(15, 5);
  });

  test("handles large coefficients", () => {
    const matrix = [
      [1000, 2000],
      [3000, 1000],
    ];
    const constants = [7000, 6000];

    const solution = solveLinearSystem(matrix, constants);

    expect(solution).not.toBeNull();
    expect(solution![0]).toBeCloseTo(1, 5);
    expect(solution![1]).toBeCloseTo(3, 5);
  });

  test("handles negative solutions", () => {
    const matrix = [
      [1, 1],
      [1, -1],
    ];
    const constants = [0, 4];

    const solution = solveLinearSystem(matrix, constants);

    expect(solution).not.toBeNull();
    expect(solution![0]).toBeCloseTo(2, 5);
    expect(solution![1]).toBeCloseTo(-2, 5);
  });
});
