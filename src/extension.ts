'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as websocket from 'websocket';
import * as shelljs from 'shelljs';
import * as fs from 'fs';
import * as tmp from 'tmp';

import * as path from './path';
import * as batch from './batch';

var wshost : any = undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // const py = shelljs.which('python');
    // const hostdir = context.asAbsolutePath('src/python-host');
    // wshost = shelljs.exec(`"${py}" main.py`, { cwd: hostdir, async: true });
    // shelljs.exec(`"${py}" --version`);  // TODO: HACK to stall command execution for a while (to allow the websocket server to spin up)

    let disposables = [
        //vscode.commands.registerCommand('merlin.invokeAllThePythons', invokeAllThePythons),
        vscode.commands.registerCommand('merlin.itCreatesUsTheJobOrUsKillsItTheKitten', createJob)
    ];

    disposables.forEach((d) => context.subscriptions.push(d), this);
}

function createJob() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }

    const doc = activeEditor.document;
    if (!doc) {
        return;
    }

    createJobImpl(doc);
}

async function createJobImpl(doc : vscode.TextDocument) {

    const jobTemplateInfo = batch.parseJobTemplate(doc.getText());
    if (!jobTemplateInfo) {
        await vscode.window.showErrorMessage('Current file is not an Azure Batch job template.');  // TODO: support job JSON
        return;
    }

    const templateFileName = doc.fileName;  // TODO: handle the case where the doc has never been saved
    const templateFileRoot = path.stripExtension(templateFileName);
    const templateFileDir = path.directory(templateFileName);

    const parameterFileNames = [
        templateFileRoot + '.parameters.json',
        templateFileDir + '/parameters.json',
        templateFileDir + '/jobparameters.json',
        templateFileDir + 'parameters.job.json'
    ];
    const parameterFileName = parameterFileNames.find(s => fs.existsSync(s));

    const hasParametersFile = (parameterFileName !== undefined);
    const knownParametersText = parameterFileName ? fs.readFileSync(parameterFileName, 'utf8') : '{}';
    const knownParameters = batch.parseParameters(knownParametersText);
    const isKnownParameter = (n : string) => knownParameters.findIndex((p) => p.name == n) >= 0;
    const anyUnknownParameters = jobTemplateInfo.parameters.findIndex((p) => !isKnownParameter(p.name)) >= 0;

    if (doc.isDirty) {
        await doc.save();
    }

    const tempFileInfo = anyUnknownParameters ?  await createTempParameterFile(jobTemplateInfo, knownParameters) : undefined;

    if (tempFileInfo && tempFileInfo.abandoned) {
        return;
    }

    const parameterFilePath = (tempFileInfo === undefined) ? parameterFileName : tempFileInfo.path;

    shelljs.exec(`az batch job create --template "${doc.fileName}" --parameters "${parameterFilePath}"`, { async: true }, (code : number, stdout : string, stderr : string) => {
        if (tempFileInfo) {
            fs.unlinkSync(tempFileInfo.path);
        }

        if (code !== 0 || stderr) {  // CLI can return exit code 0 on failure... but GAH IT WRITES TO STDERR EVEN ON SUCCESS (the experimental feature warnings)
            console.log(stderr);
        } else {
            console.log(stdout);
        }
    });

}

async function createTempParameterFile(jobTemplateInfo : batch.IJobTemplate, knownParameters : batch.IParameterValue[]) : Promise<ITempFileInfo | undefined> {
    let parameterObject : any = {};
    for (const p of jobTemplateInfo.parameters) {
        const known = knownParameters.find((pv) => pv.name == p.name);
        const value = known ? known.value : await promptForParameterValue(p);
        if (value) {
            parameterObject[p.name] = value;
        } else {
            return { abandoned: true, path: '' };
        }
    }

    const json = JSON.stringify(parameterObject);

    const tempFile = tmp.fileSync();
    
    fs.writeFileSync(tempFile.name, json, { encoding: 'utf8' });

    return { abandoned: false, path: tempFile.name };
}

async function promptForParameterValue(parameter : batch.IJobTemplateParameter) : Promise<any> {
    if (parameter.allowedValues) {
        return vscode.window.showQuickPick(parameter.allowedValues);
    } else {
        let description = '';
        if (parameter.metadata) {
            description = ` | ${parameter.metadata.description}`;
        }
        return await vscode.window.showInputBox({ prompt: `${parameter.name}${description} (${parameter.dataType})` });
    }
}

interface ITempFileInfo {
    readonly abandoned : boolean;
    readonly path : string;
}

function invokeAllThePythons() {

    // since the NCJ stuff is in the CLI not the SDK we might be better
    // off just invoking 'az batch *' commands directly via shell.exec

    const socket = new websocket.client();

    socket.on('connect', (conn) => {

        conn.on('message', (msg) => {
            vscode.window.showInformationMessage(`Received data: ${msg.utf8Data}`);
        });

        conn.send("Arse");
        conn.send("Biscuit");
    });

    socket.connect("ws://127.0.0.1:8765/ws");

    vscode.window.showInformationMessage("arsebiscuits!");
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (wshost) {

        const socket = new websocket.client();

        socket.on('connect', (conn) => {
            conn.send(":quit");
        });

        socket.connect("ws://127.0.0.1:8765/ws");

        //wshost.kill();
    }
}