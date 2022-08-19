import * as vscode from "vscode";
const childProcess = require("child_process");
const path = require("path");
const fs = require("fs");

// 是否是windows系统
const isWin = process.platform === "win32";

/**
 * 打开文件
 *
 * @param filePath 文件目录
 */
const openFile = (filePath: string) => {
  const openPath = vscode.Uri.file(filePath);
  vscode.workspace.openTextDocument(openPath).then((doc) => {
    vscode.window.showTextDocument(doc);
  });
};

/**
 * 查找文件定义的provider，匹配到了就return一个location，否则不做处理
 * 最终效果是，当按住Ctrl键时，如果return了一个location，字符串就会变成一个可以点击的链接，否则无任何效果
 * @param {*} document
 * @param {*} position
 * @param {*} token
 */
function provideDefinition(
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken
) {
  // 文件名
  const filePath = document.fileName;

  // 非package.json文件，不处理
  if (!filePath.endsWith("package.json")) {
    return;
  }

  // 当前工作目录
  const workDir = path.dirname(filePath);

  // 当前行的文字
  const line = document.lineAt(position);

  // 将所在行进行匹配，匹配第一个引号中的文字，即包名字
  const splitRes = line.text.split('"');

  // 判空
  if (splitRes.length && splitRes[1]) {
    // 包的名字
    const pkgName = splitRes[1];

    // 关键：切换node执行目录，将其切换到当前正在点击的依赖目录
    process.chdir(workDir);

    // 通过node的寻找依赖的能力，来定位根本位置
    let destPath = "";
    try {
      destPath = childProcess
        .execSync(`node -e 'console.log(require.resolve("${pkgName}"))'`)
        .toString();
    } catch (e) {
      console.log("出错啦:", e);
    }

    // 奇怪的点，childProcess返回的目录中最后有一个空格，要删除
    destPath = destPath.trimEnd();

    if (destPath && destPath.split("/").length === 1) {
      // 异常模块，和node模块名称一致，require.resolve时有问题，先忽略，比较少
      // 提示异常
      vscode.window.showInformationMessage(
        "暂不支持该依赖，该依赖和node内置方法重名"
      );
      return;
    }

    // 判空
    if (destPath && fs.existsSync(destPath)) {
      // new vscode.Position(0, 0) 表示跳转到某个文件的第一行第一列
      return new vscode.Location(
        vscode.Uri.file(destPath),
        new vscode.Position(0, 0)
      );
    }
  }
}

/**
 * 查找文件定义的provider，匹配到了就return一个location，否则不做处理
 * 最终效果是，当按住Ctrl键时，如果return了一个location，字符串就会变成一个可以点击的链接，否则无任何效果
 * @param {*} document
 * @param {*} position
 * @param {*} token
 */
function provideDefinitionForWin(
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken
) {
  const isLegalFileName = document.fileName.endsWith("package.json");

  if (!isLegalFileName) {
    return;
  }

  const fileSplitArr = document.fileName.split("\\");

  // 将 package.json 给移除
  fileSplitArr.pop();

  // 重新组装
  const filePath = fileSplitArr.join("\\\\");

  // 当前行的文字
  const line = document.lineAt(position);

  // 将所在行进行匹配，匹配第一个引号中的文字，即包名字
  const splitRes = line.text.split('"');

  // 判空
  if (splitRes.length && splitRes[1]) {
    // 包的名字
    const pkgName = splitRes[1];

    // 关键：切换node执行目录，将其切换到当前正在点击的依赖目录
    process.chdir(filePath);

    // 执行命令
    const execPath = `node -e "console.log(require.resolve('${pkgName}'))"`;

    // 通过node的寻找依赖的能力，来定位根本位置
    let destPath = "";
    try {
      destPath = childProcess.execSync(execPath).toString();
    } catch (e) {
      console.log("出错啦:", e);
    }

    // 奇怪的点，childProcess返回的目录中最后有一个空格，要删除
    destPath = destPath.trimEnd();

    if (destPath && destPath.split("\\").length === 1) {
      // 异常模块，和node模块名称一致，require.resolve时有问题，先忽略，比较少
      // 提示异常
      vscode.window.showInformationMessage(
        "暂不支持该依赖，该依赖和node内置方法重名"
      );
      return;
    }

    // 判空
    if (destPath && fs.existsSync(destPath)) {
      // new vscode.Position(0, 0) 表示跳转到某个文件的第一行第一列
      return new vscode.Location(
        vscode.Uri.file(destPath),
        new vscode.Position(0, 0)
      );
    }
  }
}

const providerJumpSymbolLink = (uri: vscode.Uri) => {
  // 当前选择的文件(夹)路径
  let selectedFilePath = uri.path;

  // 兼容windows系统
  if (isWin) {
    selectedFilePath = uri.path.substring(1, uri.path.length);
  }

  // 获取其真实路径（符号链接之后的真实路径）
  fs.realpath(selectedFilePath, {}, (err: any, dirPath: any) => {
    if (err) {
      return;
    }

    // 白名单文件，默认认为这些文件存在
    const whiteFileList = [
      "package.json",
      "index.js",
      "index.ts",
      "index.mjs",
      "index.cjs",
      "main.js",
      "main.ts",
      "main.mjs",
      "main.cjs",
    ];

    for (let i = 0; i < whiteFileList.length; i++) {
      // 遍历的文件名
      const fileName = whiteFileList[i];

      // 组装文件路径
      const filePath = `${dirPath}/${fileName}`;

      // 如果文件存在
      if (fs.existsSync(filePath)) {
        // 打开文件
        openFile(filePath);
        // 打开文件
        return;
      }
    }
  });
};

// 激活
export function activate(context: vscode.ExtensionContext) {
  // 实现package.json中的依赖支持 command + 点击 跳转进去
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(["json"], {
      provideDefinition: isWin ? provideDefinitionForWin : provideDefinition,
    })
  );

  // 实现鼠标右击跳转到符号链接真正的地址
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fe-jump.jumpSymbolLink",
      providerJumpSymbolLink
    )
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
