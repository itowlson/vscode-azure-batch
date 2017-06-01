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
var output : vscode.OutputChannel = vscode.window.createOutputChannel('Azure Batch');

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

    if (doc.isDirty) {
        await doc.save();
    }

    const parameterFile = await getParameterFile(templateFileName);

    const knownParametersText = getParameterJson(parameterFile);
    const knownParameters = batch.parseParameters(knownParametersText);
    const isKnownParameter = (n : string) => knownParameters.findIndex((p) => p.name == n) >= 0;
    const anyUnknownParameters = jobTemplateInfo.parameters.findIndex((p) => !isKnownParameter(p.name)) >= 0;

    const tempParameterInfo = anyUnknownParameters ?  await createTempParameterFile(jobTemplateInfo, knownParameters) : undefined;

    if (tempParameterInfo && tempParameterInfo.abandoned) {
        return;
    }

    const parameterFilePath = tempParameterInfo ? tempParameterInfo.path : parameterFile.path;

    output.show();
    output.appendLine('Creating Azure Batch job...');

    shelljs.exec(`az batch job create --template "${doc.fileName}" --parameters "${parameterFilePath}"`, { async: true }, (code : number, stdout : string, stderr : string) => {
        if (tempParameterInfo) {
            fs.unlinkSync(tempParameterInfo.path);
        }

        if (code !== 0 || stderr) {  // CLI can return exit code 0 on failure... but GAH IT WRITES TO STDERR EVEN ON SUCCESS (the experimental feature warnings)
            output.appendLine(stderr);
        } else {
            output.appendLine(stdout);
        }

        output.appendLine("Done");
    });

}

async function getParameterFile(templateFileName : string) : Promise<IParameterFileInfo> {
    const templateFileRoot = path.stripExtension(templateFileName);
    const templateFileDir = path.directory(templateFileName);

    const parameterFileNames = [
        templateFileRoot + '.parameters.json',
        templateFileDir + '/parameters.json',
        templateFileDir + '/jobparameters.json',
        templateFileDir + '/parameters.job.json'
    ];
    const parameterFileName = parameterFileNames.find(s => fs.existsSync(s));

    if (!parameterFileName) {
        return {
            exists: false,
            path: ''
        };
    }

    const parametersDoc = vscode.workspace.textDocuments.find((d) => path.equal(d.fileName, parameterFileName));
    if (parametersDoc && parametersDoc.isDirty) {
        await parametersDoc.save();
    }

    return {
        exists: true,
        path: parameterFileName,
        document: parametersDoc
    };
}

function getParameterJson(parameterFile : IParameterFileInfo) : string {
    if (parameterFile.exists) {
        return parameterFile.document ? parameterFile.document.getText() : fs.readFileSync(parameterFile.path, 'utf8');
    }
    return '{}';
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
    let description = '';
    if (parameter.metadata) {
        description = ` | ${parameter.metadata.description}`;
    }

    if (parameter.allowedValues) {
        const allowedValueQuickPicks = parameter.allowedValues.map((v) => quickPickFor(v));
        const opts = { placeHolder: `${parameter.name}${description}` };
        const selectedValue = await vscode.window.showQuickPick(allowedValueQuickPicks, opts);
        return selectedValue ? selectedValue.value : undefined;
    } else {
        const opts = {
            prompt: `${parameter.name}${description} (${parameter.dataType})`,
            value: parameter.defaultValue ? String(parameter.defaultValue) : undefined
            // TODO: set the validateInput option to do range checking
        };
        return await vscode.window.showInputBox(opts);
    }
}

function quickPickFor(value : any) : AllowedValueQuickPickItem {
    return {
        label: String(value),
        description: '',
        value: value
    };
}

interface AllowedValueQuickPickItem extends vscode.QuickPickItem {
    value : any
}

interface ITempFileInfo {
    readonly abandoned : boolean;
    readonly path : string;
}

interface IParameterFileInfo {
    readonly exists : boolean;
    readonly path : string;
    readonly document? : vscode.TextDocument;
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