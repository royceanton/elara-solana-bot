import { exec } from 'child_process';
import fs from 'fs';
import util from 'util';

const writeFile = util.promisify(fs.writeFile);

/**
 * Runs a Python script and saves its output as a JSON file.
 *
 * @param scriptPath - The path to the Python script.
 * @param args - An array of arguments to pass to the Python script.
 * @param outputPath - The path where the output JSON file should be saved.
 * @returns A promise that resolves with the output of the Python script.
 */
export async function runPythonScriptAndSaveOutput(scriptPath: string, args: string[], outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(`python3 "${scriptPath}" ${args.join(' ')}`, async (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                reject(error);
            } else if (stderr) {
                console.error(`stderr: ${stderr}`);
                reject(new Error(stderr));
            } else {
                try {
                    // Save the output to a JSON file
                    await writeFile(outputPath, stdout);
                    resolve(stdout);
                } catch (error) {
                    console.error(`writeFile error: ${error}`);
                    reject(error);
                }
            }
        });
    });
}