
class ASTParser {
    /**
     * Create a new ASTParser instance
     * @param {string} language - Programming language ('c', 'cpp', 'javascript', etc.)
     */
    constructor(language = 'c') {
        this.language = language;
    }

    /**
     * Parse code into AST-like structure
     * @param {string} code - Source code to parse
     * @returns {Object} AST object with type, body, and source
     */
    parse(code) {
        try {
            if (!code || typeof code !== 'string') {
                throw new Error('Invalid code input: code must be a non-empty string');
            }

           
            const cleanedCode = this.removeComments(code);
            
            let result;
            try {
                switch(this.language) {
                    case 'javascript':
                        result = this.parseJavaScript(cleanedCode);
                        break;
                    case 'c':
                    case 'cpp':
                        result = this.parseC(cleanedCode);
                        break;
                    case 'python':
                        result = this.parsePython(cleanedCode);
                        break;
                    case 'java':
                        result = this.parseJava(cleanedCode);
                        break;
                    case 'rust':
                        result = this.parseRust(cleanedCode);
                        break;
                    case 'go':
                        result = this.parseGo(cleanedCode);
                        break;
                    default:
                        result = this.parseGeneric(cleanedCode);
                }
            } catch (parseError) {
               
                debugWarn(`Language-specific parser failed for ${this.language}, trying generic parser:`, parseError.message);
                try {
                    result = this.parseGeneric(cleanedCode);
                } catch (genericError) {
                   
                    debugError('All parsers failed, returning empty AST:', genericError);
                    result = {
                        type: 'Program',
                        body: [],
                        source: code
                    };
                }
            }
            
           
            if (!result || typeof result !== 'object') {
                result = {
                    type: 'Program',
                    body: [],
                    source: code
                };
            }
            
            if (!result.body) {
                result.body = [];
            }
            
            return result;
        } catch (error) {
           
            debugError('Critical error in parse, returning empty AST:', error);
            return {
                type: 'Program',
                body: [],
                source: code || ''
            };
        }
    }

    /**
     * Remove comments from code
     * @param {string} code - Source code
     * @returns {string} Code with comments removed
     */
    removeComments(code) {
        try {
           
            let cleaned = code.replace(/\/\/.*$/gm, '');
            
            cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
            return cleaned;
        } catch (error) {
            debugError('Error removing comments:', error);
            return code; 
        }
    }

    /**
     * Parse JavaScript using Acorn (if available) or fallback
     * @param {string} code - JavaScript source code
     * @returns {Object} AST object
     */
    parseJavaScript(code) {
        const ast = {
            type: 'Program',
            body: [],
            source: code
        };

        try {
           
            if (typeof acorn !== 'undefined') {
                try {
                    const parsed = acorn.parse(code, { 
                        ecmaVersion: 2020, 
                        locations: true,
                        allowReturnOutsideFunction: true,
                        allowAwaitOutsideFunction: true
                    });
                    return this.convertAcornAST(parsed);
                } catch (parseError) {
                    
                    debugWarn('Acorn parsing failed (code may have syntax errors), using fallback:', parseError.message);
                    
                }
            }
        } catch (e) {
            
            debugWarn('Error in parseJavaScript, using fallback:', e);
        }

        try {
            return this.parseGeneric(code);
        } catch (fallbackError) {
            
            debugError('Fallback parser also failed:', fallbackError);
            return {
                type: 'Program',
                body: [],
                source: code
            };
        }
    }

    convertAcornAST(acornAST) {
        const nodes = [];
        
        const evaluateExpr = (node) => {
            try {
                if (!node) return null;
                if (node.type === 'Literal') {
                    return node.value;
                }
                if (node.type === 'Identifier') {
                    return node.name;
                }
                if (node.type === 'BinaryExpression') {
                    const left = evaluateExpr(node.left);
                    const right = evaluateExpr(node.right);
                    if (typeof left === 'number' && typeof right === 'number') {
                        if (node.operator === '*') return left * right;
                        if (node.operator === '+') return left + right;
                    }
                }
                return null;
            } catch (error) {
                debugWarn('Error evaluating expression:', error);
                return null;
            }
        };
        
        function traverse(node) {
            try {
                if (!node) return;
                
                
                if (node.type === 'VariableDeclaration') {
                    try {
                        if (node.declarations && Array.isArray(node.declarations)) {
                            node.declarations.forEach(decl => {
                                try {
                                    if (decl && decl.init) {
                                        const initNode = decl.init;
                                        
                                        
                                        if (initNode.type === 'NewExpression') {
                                            nodes.push({
                                                type: 'Allocation',
                                                var: decl.id ? decl.id.name : 'unknown',
                                                line: node.loc ? node.loc.start.line : 0,
                                                function: initNode.callee ? (initNode.callee.name || 'new') : 'new',
                                                args: initNode.arguments ? initNode.arguments.map(arg => evaluateExpr(arg)) : [],
                                                nodeType: 'VariableDeclaration',
                                                originalNode: node
                                            });
                                        }
                                        
                                       
                                        if (initNode.type === 'ArrayExpression') {
                                            nodes.push({
                                                type: 'Allocation',
                                                var: decl.id ? decl.id.name : 'unknown',
                                                line: node.loc ? node.loc.start.line : 0,
                                                function: 'Array',
                                                args: [initNode.elements ? initNode.elements.length : 0],
                                                nodeType: 'VariableDeclaration',
                                                originalNode: node
                                            });
                                        }
                                        
                                        
                                        if (initNode.type === 'ObjectExpression') {
                                            nodes.push({
                                                type: 'Allocation',
                                                var: decl.id ? decl.id.name : 'unknown',
                                                line: node.loc ? node.loc.start.line : 0,
                                                function: 'Object',
                                                args: [initNode.properties ? initNode.properties.length : 0],
                                                nodeType: 'VariableDeclaration',
                                                originalNode: node
                                            });
                                        }
                                    }
                                } catch (declError) {
                                    debugWarn('Error processing declaration:', declError);
                                    
                                }
                            });
                        }
                    } catch (varDeclError) {
                        debugWarn('Error processing variable declaration:', varDeclError);
                      
                    }
                }
                
                if (node.type === 'AssignmentExpression') {
                    try {
                        if (node.right && node.right.type === 'Literal' && (node.right.value === null || node.right.raw === 'undefined')) {
                            if (node.left && node.left.name) {
                                nodes.push({
                                    type: 'Deallocation',
                                    var: node.left.name,
                                    line: node.loc ? node.loc.start.line : 0,
                                    function: 'null',
                                    nodeType: 'AssignmentExpression',
                                    originalNode: node
                                });
                            }
                        }
                    } catch (assignError) {
                        debugWarn('Error processing assignment:', assignError);
                       
                    }
                }
                
                try {
                    for (const key in node) {
                        if (key === 'parent' || key === 'loc') continue;
                        try {
                            const child = node[key];
                            if (Array.isArray(child)) {
                                child.forEach(childNode => {
                                    try {
                                        traverse(childNode);
                                    } catch (childError) {
                                        debugWarn('Error traversing child array element:', childError);
                                       
                                    }
                                });
                            } else if (child && typeof child === 'object' && child.type) {
                                traverse(child);
                            }
                        } catch (keyError) {
                            debugWarn('Error accessing node property:', key, keyError);
                            
                        }
                    }
                } catch (traverseError) {
                    debugWarn('Error in traversal loop:', traverseError);
                    
                }
            } catch (error) {
                debugWarn('Error in traverse function:', error);
                
            }
        }
        
        try {
            traverse(acornAST);
        } catch (error) {
            debugError('Error traversing AST:', error);
            
        }
        
        return {
            type: 'Program',
            body: nodes,
            source: acornAST.source || ''
        };
    }

    parseC(code) {
        const lines = code.split('\n');
        const nodes = [];
        let currentFunction = null;
        let braceDepth = 0;
        let inLoop = false;
        let loopDepth = 0;
        
        let currentStatement = '';
        let statementStartLine = 0;
        let inStatement = false;
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const trimmed = line.trim();
            
            if (!trimmed) {
                if (inStatement) {
                    currentStatement += ' ' + trimmed;
                }
                return;
            }
            const funcMatch = trimmed.match(/(\w+)\s*\([^)]*\)\s*\{?/);
            if (funcMatch && !trimmed.match(/\b(if|while|for|switch)\s*\(/)) {
                currentFunction = funcMatch[1];
            }
            
            if (trimmed.match(/\b(for|while|do)\s*\(/)) {
                inLoop = true;
                loopDepth++;
            }
            
           
            const openBraces = (trimmed.match(/\{/g) || []).length;
            const closeBraces = (trimmed.match(/\}/g) || []).length;
            braceDepth += openBraces - closeBraces;
            
            
            if (trimmed.endsWith('\\') || (!trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}'))) {
                if (!inStatement) {
                    currentStatement = trimmed;
                    statementStartLine = lineNum;
                    inStatement = true;
                } else {
                    currentStatement += ' ' + trimmed;
                }
                return;
            }
            
           
            if (inStatement) {
                currentStatement += ' ' + trimmed;
                const completeStatement = currentStatement;
                inStatement = false;
                
                
                const alloc = this.parseCAllocation(completeStatement, statementStartLine || lineNum, line, currentFunction, inLoop);
                if (alloc) {
                    nodes.push(alloc);
                }
                
                
                const dealloc = this.parseCDeallocation(completeStatement, statementStartLine || lineNum, line);
                if (dealloc) {
                    nodes.push(dealloc);
                }
                
               
                currentStatement = '';
                statementStartLine = 0;
            } else {
               
                const alloc = this.parseCAllocation(trimmed, lineNum, line, currentFunction, inLoop);
                if (alloc) {
                    nodes.push(alloc);
                }
                
                
                const dealloc = this.parseCDeallocation(trimmed, lineNum, line);
                if (dealloc) {
                    nodes.push(dealloc);
                }
            }
            
            
            if (braceDepth === 0) {
                if (inLoop && loopDepth > 0) {
                    loopDepth--;
                    if (loopDepth === 0) inLoop = false;
                }
                if (currentFunction) {
                    currentFunction = null;
                }
            }
        });
        
        return {
            type: 'Program',
            body: nodes,
            source: code
        };
    }

    parseCAllocation(line, lineNum, originalLine, functionName, inLoop) {
        
        const patterns = [
            // type *var = malloc(...)
            /\w+\s+\*\s*(\w+)\s*=\s*(malloc|calloc|realloc)\s*\(\s*([^)]+)\s*\)/,
            // type* var = malloc(...)
            /\w+\*\s*(\w+)\s*=\s*(malloc|calloc|realloc)\s*\(\s*([^)]+)\s*\)/,
            // var = (type*)malloc(...)
            /(\w+)\s*=\s*\([^)]*\)\s*(malloc|calloc|realloc)\s*\(\s*([^)]+)\s*\)/,
            // var = malloc(...)
            /(\w+)\s*=\s*(malloc|calloc|realloc)\s*\(\s*([^)]+)\s*\)/,
        ];
        
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                const varName = match[1];
                const func = match[2];
                const args = match[3] || '';
                
                return {
                    type: 'Allocation',
                    var: varName,
                    line: lineNum,
                    function: func,
                    args: args,
                    functionName: functionName,
                    inLoop: inLoop,
                    nodeType: 'VariableDeclaration',
                    originalLine: originalLine.trim()
                };
            }
        }
        
        
        const cppPatterns = [
            /\w+\s+\*\s*(\w+)\s*=\s*new\s+\w+\s*\(\s*([^)]*)\s*\)/,
            /\w+\*\s*(\w+)\s*=\s*new\s+\w+\s*\(\s*([^)]*)\s*\)/,
            /\w+\s+\*\s*(\w+)\s*=\s*new\s+\w+/,
            /\w+\*\s*(\w+)\s*=\s*new\s+\w+/,
            /\w+\s+\*\s*(\w+)\s*=\s*new\s+\w+\s*\[\s*([^\]]+)\s*\]/,
            /\w+\*\s*(\w+)\s*=\s*new\s+\w+\s*\[\s*([^\]]+)\s*\]/,
            /(\w+)\s*=\s*new\s+\w+\s*\(\s*([^)]*)\s*\)/,
            /(\w+)\s*=\s*new\s+\w+/,
            /(\w+)\s*=\s*new\s+\w+\s*\[\s*([^\]]+)\s*\]/,
        ];
        
        for (const pattern of cppPatterns) {
            const match = line.match(pattern);
            if (match) {
                const varName = match[1];
                const args = match[2] || '';
                const isArray = line.includes('[') && line.includes(']');
                
                return {
                    type: 'Allocation',
                    var: varName,
                    line: lineNum,
                    function: isArray ? 'new[]' : 'new',
                    args: args,
                    functionName: functionName,
                    inLoop: inLoop,
                    nodeType: 'VariableDeclaration',
                    originalLine: originalLine.trim()
                };
            }
        }
        
        return null;
    }

    parseCDeallocation(line, lineNum, originalLine) {
       
        const freeMatch = line.match(/free\s*\(\s*(\w+)\s*\)/);
        if (freeMatch) {
            return {
                type: 'Deallocation',
                var: freeMatch[1],
                line: lineNum,
                function: 'free',
                nodeType: 'CallExpression',
                originalLine: originalLine.trim()
            };
        }
        
        
        const deleteArrayMatch = line.match(/delete\s*\[\s*\]\s*(?:\(\s*)?(\w+)(?:\s*\))?/);
        if (deleteArrayMatch) {
            return {
                type: 'Deallocation',
                var: deleteArrayMatch[1],
                line: lineNum,
                function: 'delete[]',
                nodeType: 'CallExpression',
                originalLine: originalLine.trim()
            };
        }
        
        const deleteMatch = line.match(/delete\s+(?:\(\s*)?(\w+)(?:\s*\))?/);
        if (deleteMatch) {
            return {
                type: 'Deallocation',
                var: deleteMatch[1],
                line: lineNum,
                function: 'delete',
                nodeType: 'CallExpression',
                originalLine: originalLine.trim()
            };
        }
        
        return null;
    }

    
    parseGeneric(code) {
        return this.parseC(code); 
    }

    parsePython(code) {
        return this.parseGeneric(code);
    }

    parseJava(code) {
        return this.parseGeneric(code);
    }

    parseRust(code) {
        return this.parseGeneric(code);
    }

    parseGo(code) {
        return this.parseGeneric(code);
    }
}

