const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const debounce = require('lodash.debounce')

let isTracking = false
let logFilePath

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	const folderUri = await vscode.window.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: 'Select Folder for Log File'
	})

	if (!folderUri || folderUri.length === 0) {
		vscode.window.showErrorMessage('No folder selected. Logging will not work.')

		return
	}

	logFilePath = path.join(folderUri[0].fsPath, 'user-events.log')

	if (!fs.existsSync(logFilePath)) {
		fs.writeFileSync(logFilePath, '', 'utf8')
	}

	const startTrackingCommand = vscode.commands.registerCommand('revelo-tasks-tracker.startTracking', function () {
		if (isTracking) {
			vscode.window.showInformationMessage('Tracking is already enabled.')
			return
		}

		isTracking = true

		vscode.window.showInformationMessage('Tracking Started')

		logEvent({
			action: 'tracking_started',
			message: 'Tracking started'
		})

		const documentTextMap = new Map()

		context.subscriptions.push(
			vscode.workspace.onDidOpenTextDocument((document) => {
				documentTextMap.set(document.uri.toString(), document.getText())
			}),

			vscode.workspace.onDidChangeTextDocument(
				debounce((event) => {
					const editor = vscode.window.activeTextEditor

					if (editor && event.document === editor.document) {
						logEvent({
							action: 'text_document_changed',
							message: {
								uri: editor.document.uri.toString(),
								text: editor.document.getText()
							}
						})
					}
				}, 1000)
			),

			vscode.commands.registerCommand('revelo-tasks-tracker.clipboardCopy', async (event) => {
				await vscode.commands.executeCommand('editor.action.clipboardCopyAction')

				const editor = vscode.window.activeTextEditor

				if (editor) {
					const selectedText = editor.document.getText(editor.selection)

					logEvent({
						action: 'copy',
						message: {
							text: editor.document.getText(),
							selectedText: selectedText
						}
					})
				}
			}),

			vscode.commands.registerCommand('revelo-tasks-tracker.clipboardPaste', async () => {
				await vscode.commands.executeCommand('editor.action.clipboardPasteAction')

				const editor = vscode.window.activeTextEditor

				if (editor) {
					logEvent({
						action: 'paste',
						message: {
							text: editor.document.getText()
						}
					})
				}
			}),

			vscode.window.onDidOpenTerminal(() => {
				logEvent({ action: 'terminal_opened' })
			}),

			vscode.window.onDidStartTerminalShellExecution((event) => {
				logEvent({
					action: 'terminal_shell_execution_started',
					message: {
						name: event.terminal.name,
						command: event.execution.commandLine.value,
						path: event.execution.cwd
					}
				})
			}),

			vscode.window.onDidCloseTerminal(() => {
				logEvent({ action: 'terminal_closed' })
			}),

			vscode.commands.registerCommand('revelo-tasks-tracker.handleWorkspaceSetup', async (args) => {
				console.log(args)
			}),

			vscode.window.registerUriHandler({
				handleUri(uri) {
					console.log(uri)

					// do something with the provided uri
					// vscode.commands.executeCommand('revelo-tasks-tracker.handleWorkspaceSetup', {
					// 	arg1,
					// 	arg2
					// })
				}
			})
		)
	})

	context.subscriptions.push(startTrackingCommand)
}

function logEvent(event) {
	if (!logFilePath) return

	const timestamp = new Date().toISOString()

	const logMessage = JSON.stringify({
		action: event.action,
		timestamp: timestamp,
		message: event.message
	}, null, 2)

	try {
		if (!fs.existsSync(logFilePath)) {
			fs.writeFileSync(logFilePath, '', 'utf8')
		}

		fs.appendFileSync(logFilePath, logMessage, 'utf8')
	} catch (error) {
		console.error('Failed to write to log file:', error)
	}
}

function deactivate() {
	isTracking = false

	logEvent({
		action: 'tracking_stopped',
		message: 'Tracking stopped'
	})
}

module.exports = {
	activate,
	deactivate
}