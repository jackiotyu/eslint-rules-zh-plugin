const vscode = require('vscode');
const eslintRules = require('../rules');
const RULE_URL = require('./const/rule-urls');

// TODO: 代码重构 & 改造成ts
function provideHover(document, position) {
    const diagnostics = vscode.languages
        .getDiagnostics(document.uri)
        .filter((diagnostic) => {
            if (diagnostic.source !== 'eslint') {
                return false;
            }
            if (position.line === diagnostic.range.start.line && position.line === diagnostic.range.end.line && position.character >= diagnostic.range.start.character && position.character <= diagnostic.range.end.character) { // 单行
                return true;
            } else if (position.line >= diagnostic.range.start.line && position.line <= diagnostic.range.end.line) { // 多行
                return true;
            }
            return false;
        });
    if (diagnostics && diagnostics.length > 0) {
        const contents = diagnostics.map((diagnostic) => {
            if (typeof diagnostic.code === 'object') {
                const ruleId = String(diagnostic.code.value);
                const rule = eslintRules[ruleId];
                if (/typescript-eslint/.test(ruleId)) { // typescript-eslint 规则
                    const  url = RULE_URL.TYPESCRIPT + ruleId.replace('@typescript-eslint/', '');
                    return new vscode.MarkdownString('$(lightbulb) [ts-eslint提示：' + rule.zh + '](' + url + ') ', true)
                } else {
                    let url = RULE_URL.BASE + ruleId;
                    if (/vue/.test(ruleId)) { // eslint-plugin-vue 规则
                        url = RULE_URL.VUE + ruleId.replace('vue/', '');
                    } else if (/react/.test(ruleId)) { // eslint-plugin-react 规则
                        url = RULE_URL.REACT + ruleId.replace('react/', '') + '.md';
                    }
                    return new vscode.MarkdownString('$(lightbulb) [eslint提示：' + rule.zh + '](' + url + ') ', true)
                }
            } else {
                return null;
            }
        }).filter(diagnostic => !!diagnostic)
        return contents.length ? {
            contents
        } : null
    }
    return;
}

const errorDecorationType = vscode.window.createTextEditorDecorationType({
    after: { margin: '0 0 0 1rem', textDecoration: 'none' },
});

// 行尾语言诊断提示
function updateDiagnostics(editor) {
    const active = vscode.workspace.getConfiguration('eslint-rules-zh-plugin').get('enableErrorLens', true);
    if (!active) {
        editor.setDecorations(errorDecorationType, []);
        return;
    }
    // TODO 用配置文件自定义颜色
    const getColorForSeverity = (severity) => {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error:
                return 'red';
            case vscode.DiagnosticSeverity.Warning:
                return 'yellow';
            case vscode.DiagnosticSeverity.Information:
                return 'blue';
            case vscode.DiagnosticSeverity.Hint:
                return 'green';
            default:
                return 'white';
        }
    }
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const decorationsArray = [];
    diagnostics
        .filter((diagnostic) => diagnostic.source === 'eslint' && typeof diagnostic.code === 'object')
        .forEach((diagnostic) => {
            const line = diagnostic.range.end.line;
            const lineText = editor.document.lineAt(line);
            const endPos = lineText.range.end;
            const ruleId = String(diagnostic.code.value);
            const rule = eslintRules[ruleId];
            if(!rule || !rule.zh) return;
            let ruleText = /typescript-eslint/.test(ruleId)
                ? `ts-eslint提示：${rule.zh}`
                : `eslint提示：${rule.zh}`;
            const decoration = {
                range: new vscode.Range(endPos, endPos),
                renderOptions: {
                    after: {
                        contentText: `${ruleText}`,
                        color: getColorForSeverity(diagnostic.severity),
                    },
                },
            };
            decorationsArray.push(decoration);
        });

    editor.setDecorations(errorDecorationType, decorationsArray);
}

// 激活插件
function activate(context) {
    const selector = [];
    for (const language of ['javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'vue']) {
        selector.push({ language, scheme: 'file' });
        selector.push({ language, scheme: 'untitled' });
    }

    // 注册鼠标悬停提示
    context.subscriptions.push(vscode.languages.registerHoverProvider(selector, {
        provideHover
    }));

    vscode.languages.onDidChangeDiagnostics(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor) updateDiagnostics(editor)
    });
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) updateDiagnostics(editor);
    });
    vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri === event.document.uri) updateDiagnostics(editor)
    });
    vscode.workspace.onDidChangeConfiguration(e => {
        // 监听配置启用/禁用
        if(e.affectsConfiguration('eslint-rules-zh-plugin.enableErrorLens')) {
            vscode.window.visibleTextEditors.forEach(editor => updateDiagnostics(editor));
        }
    })
}

module.exports = {
    activate
}