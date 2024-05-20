const vscode = require('vscode');
const eslintRules = require('../rules');
const RULE_URL = require('./const/rule-urls');

// TODO: 代码重构 & 改造成ts

// 定义诊断集合，用于存储新增的中文翻译诊断信息
const diagnosticsCollection = vscode.languages.createDiagnosticCollection('eslint-rules-zh-plugin');
const TS_ESLINT_TAG = `💡ts-eslint提示`;
const ESLINT_TAG = `💡eslint提示`;

function getRuleUrl(ruleId) {
    if (/typescript-eslint/.test(ruleId)) {
        // typescript-eslint 规则
        return RULE_URL.TYPESCRIPT + ruleId.replace('@typescript-eslint/', '');
    } else {
        let url = RULE_URL.BASE + ruleId;
        if (/vue/.test(ruleId)) {
            // eslint-plugin-vue 规则
            return RULE_URL.VUE + ruleId.replace('vue/', '');
        } else if (/react/.test(ruleId)) {
            // eslint-plugin-react 规则
            return RULE_URL.REACT + ruleId.replace('react/', '') + '.md';
        }
        return url;
    }
}

function getTagByRuleId(ruleId) {
    if (/typescript-eslint/.test(ruleId)) return TS_ESLINT_TAG;
    else return ESLINT_TAG;
}

// 生成诊断信息的唯一标识
function generateKey(diagnostic) {
    return `${diagnostic.range.start.line}-${diagnostic.range.start.character}-${diagnostic.message}`;
}

// 更新诊断集合
function updateDiagnostics(filepath) {
    const uri = vscode.Uri.file(filepath);
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const curDiagnostics = diagnosticsCollection.get(uri) || [];
    const newDiagnostics = [];
    if (diagnostics.length === 0) {
        if (curDiagnostics.length) diagnosticsCollection.delete(uri);
        return;
    }
    // 不存在错误信息时，清空信息
    if (
        diagnostics.length &&
        diagnostics.every((diagnostic) => diagnostic.source === TS_ESLINT_TAG || diagnostic.source === ESLINT_TAG)
    ) {
        diagnosticsCollection.delete(uri);
        return;
    }
    const translatedMap = new Map(curDiagnostics.map((diagnostic) => [generateKey(diagnostic), 1]));
    diagnostics
        .filter((item) => {
            return (
                item.source === 'eslint' &&
                typeof item.code === 'object' &&
                !translatedMap.has(generateKey(item)) &&
                item.source !== TS_ESLINT_TAG &&
                item.source !== ESLINT_TAG
            );
        })
        .forEach((item) => {
            const ruleId = String(item.code.value);
            const rule = eslintRules[ruleId];
            if (!rule || !rule.zh) return;
            const message = rule.zh;
            const diagnostic = new vscode.Diagnostic(item.range, message, item.severity);
            diagnostic.source = getTagByRuleId(ruleId);
            diagnostic.code = {
                value: item.code.value,
                target: vscode.Uri.parse(getRuleUrl(ruleId)),
            };
            diagnostic.relatedInformation = item.relatedInformation;
            diagnostic.tags = item.tags;
            newDiagnostics.push(diagnostic);
        });
    if (newDiagnostics.length === 0) {
        return;
    }
    const allSame =
        curDiagnostics.length &&
        newDiagnostics.every((i, index) => generateKey(i) === generateKey(curDiagnostics[index]));
    if (allSame) return;
    // 更新诊断集合
    diagnosticsCollection.set(uri, newDiagnostics);
}

function debounceWithArgsAndGroups(func, delay) {
    const groups = {};
    return function (...args) {
        const context = this;
        const key = JSON.stringify(args);
        if (groups[key]) {
            clearTimeout(groups[key]);
        } else {
            // 首次传入时立即执行函数
            func.apply(context, args);
        }
        groups[key] = setTimeout(() => {
            func.apply(context, args);
            delete groups[key];
        }, delay);
    };
}

// 激活插件
function activate(context) {
    const selector = [];
    for (const language of ['javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'vue']) {
        selector.push({ language, scheme: 'file' });
        selector.push({ language, scheme: 'untitled' });
    }

    const updateDiagnosticsDebounced = debounceWithArgsAndGroups(updateDiagnostics, 100);
    const languageMap = new Map(
        ['javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'vue'].map((language) => [language, 1]),
    );
    // 监听诊断信息变化，根据语言类型做过滤
    const translatedDiagnostics = vscode.languages.onDidChangeDiagnostics((event) => {
        const filepathMap = new Map(event.uris.map((uri) => [uri.fsPath, 1]));
        const processDocs = vscode.workspace.textDocuments.filter(
            (doc) => filepathMap.has(doc.uri.fsPath) && languageMap.has(doc.languageId),
        );
        processDocs.forEach((doc) => updateDiagnosticsDebounced(doc.uri.fsPath));
    });
    context.subscriptions.push(translatedDiagnostics, diagnosticsCollection);
}

module.exports = {
    activate,
};
