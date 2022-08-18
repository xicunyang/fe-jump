import * as vscode from "vscode";
const childProcess = require("child_process");
const path = require("path");
const fs = require("fs");

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
  const fileName = document.fileName;

  // 非package.json文件，不处理
  if (!/\/package\.json$/.test(fileName)) {
    return;
  }

  // 当前工作目录
  const workDir = path.dirname(fileName);

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

    // 判空
    if (destPath) {
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
  const selectedFilePath = uri.path as string;

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
      provideDefinition,
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
