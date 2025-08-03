class OpenAPIDiff {
    constructor() {
        this.spec1 = null;
        this.spec2 = null;
        this.changes = [];
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File upload handling
        ['upload1', 'upload2'].forEach((id, index) => {
            const uploadArea = document.getElementById(id);
            const fileInput = document.getElementById(`file${index + 1}`);
            
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', this.handleDragOver);
            uploadArea.addEventListener('dragleave', this.handleDragLeave);
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e, index + 1));
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e, index + 1));
        });

        // Compare button
        document.getElementById('compareBtn').addEventListener('click', () => this.compareSpecs());

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterChanges(e.target.dataset.filter));
        });

        // Export buttons
        document.getElementById('exportMarkdown').addEventListener('click', () => this.exportMarkdown());
        document.getElementById('exportJSON').addEventListener('click', () => this.exportJSON());
        document.getElementById('exportHTML').addEventListener('click', () => this.exportHTML());
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('dragover');
    }

    handleDrop(e, fileNumber) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0], fileNumber);
        }
    }

    handleFileSelect(e, fileNumber) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file, fileNumber);
        }
    }

    async processFile(file, fileNumber) {
        try {
            const content = await this.readFile(file);
            let parsed;
            
            if (file.name.endsWith('.json')) {
                parsed = JSON.parse(content);
            } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
                parsed = jsyaml.load(content);
            } else {
                throw new Error('Unsupported file format');
            }

            if (fileNumber === 1) {
                this.spec1 = parsed;
            } else {
                this.spec2 = parsed;
            }

            this.updateFileInfo(file, fileNumber, parsed);
            this.updateCompareButton();
        } catch (error) {
            alert(`Error parsing file: ${error.message}`);
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    updateFileInfo(file, fileNumber, spec) {
        const info = document.getElementById(`info${fileNumber}`);
        const pathCount = this.countPaths(spec);
        const version = spec.info?.version || 'Unknown';
        
        info.innerHTML = `
            <strong>${file.name}</strong><br>
            Version: ${version}<br>
            Paths: ${pathCount}<br>
            Size: ${(file.size / 1024).toFixed(1)} KB
        `;
        info.style.display = 'block';
    }

    countPaths(spec) {
        return spec.paths ? Object.keys(spec.paths).length : 0;
    }

    updateCompareButton() {
        const btn = document.getElementById('compareBtn');
        btn.disabled = !(this.spec1 && this.spec2);
    }

    async compareSpecs() {
        if (!this.spec1 || !this.spec2) return;

        const btn = document.getElementById('compareBtn');
        btn.innerHTML = '<div class="loading-spinner"></div> Comparing...';
        btn.disabled = true;

        // Small delay to show loading state
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            this.changes = [];
            this.compareInfo();
            this.comparePaths();
            this.compareComponents();
            
            this.displayResults();
        } catch (error) {
            alert(`Error during comparison: ${error.message}`);
        } finally {
            btn.innerHTML = '🔍 Compare API Specifications';
            btn.disabled = false;
        }
    }

    compareInfo() {
        const info1 = this.spec1.info || {};
        const info2 = this.spec2.info || {};

        if (info1.version !== info2.version) {
            this.addChange({
                type: 'Version Change',
                path: 'info.version',
                category: 'modified',
                isBreaking: false,
                details: {
                    old: info1.version,
                    new: info2.version
                }
            });
        }

        if (info1.title !== info2.title) {
            this.addChange({
                type: 'Title Change',
                path: 'info.title',
                category: 'modified',
                isBreaking: false,
                details: {
                    old: info1.title,
                    new: info2.title
                }
            });
        }
    }

    comparePaths() {
        const paths1 = this.spec1.paths || {};
        const paths2 = this.spec2.paths || {};

        const allPaths = new Set([...Object.keys(paths1), ...Object.keys(paths2)]);

        allPaths.forEach(path => {
            if (paths1[path] && !paths2[path]) {
                this.addChange({
                    type: 'Path Removed',
                    path: path,
                    category: 'removed',
                    isBreaking: true,
                    details: {
                        methods: Object.keys(paths1[path])
                    }
                });
            } else if (!paths1[path] && paths2[path]) {
                this.addChange({
                    type: 'Path Added',
                    path: path,
                    category: 'added',
                    isBreaking: false,
                    details: {
                        methods: Object.keys(paths2[path])
                    }
                });
            } else if (paths1[path] && paths2[path]) {
                this.comparePathMethods(path, paths1[path], paths2[path]);
            }
        });
    }

    comparePathMethods(path, methods1, methods2) {
        const allMethods = new Set([...Object.keys(methods1), ...Object.keys(methods2)]);

        allMethods.forEach(method => {
            if (method === 'parameters') return; // Skip path-level parameters for now

            if (methods1[method] && !methods2[method]) {
                this.addChange({
                    type: `${method.toUpperCase()} Method Removed`,
                    path: `${path}`,
                    category: 'removed',
                    isBreaking: true,
                    details: {
                        method: method,
                        summary: methods1[method].summary
                    }
                });
            } else if (!methods1[method] && methods2[method]) {
                this.addChange({
                    type: `${method.toUpperCase()} Method Added`,
                    path: `${path}`,
                    category: 'added',
                    isBreaking: false,
                    details: {
                        method: method,
                        summary: methods2[method].summary
                    }
                });
            } else if (methods1[method] && methods2[method]) {
                this.compareMethodDetails(path, method, methods1[method], methods2[method]);
            }
        });
    }

    compareMethodDetails(path, method, method1, method2) {
        // Compare responses
        const responses1 = method1.responses || {};
        const responses2 = method2.responses || {};
        
        const allStatusCodes = new Set([...Object.keys(responses1), ...Object.keys(responses2)]);
        
        allStatusCodes.forEach(statusCode => {
            if (responses1[statusCode] && !responses2[statusCode]) {
                this.addChange({
                    type: 'Response Removed',
                    path: `${path}.${method}.responses.${statusCode}`,
                    category: 'removed',
                    isBreaking: true,
                    details: {
                        statusCode,
                        description: responses1[statusCode].description
                    }
                });
            } else if (!responses1[statusCode] && responses2[statusCode]) {
                this.addChange({
                    type: 'Response Added',
                    path: `${path}.${method}.responses.${statusCode}`,
                    category: 'added',
                    isBreaking: false,
                    details: {
                        statusCode,
                        description: responses2[statusCode].description
                    }
                });
            } else if (responses1[statusCode] && responses2[statusCode]) {
                // Compare existing responses for content and schema changes
                this.compareResponseDetails(path, method, statusCode, responses1[statusCode], responses2[statusCode]);
            }
        });

        // Compare parameters
        const params1 = method1.parameters || [];
        const params2 = method2.parameters || [];
        
        this.compareParameters(path, method, params1, params2);

        // Compare request body
        if (method1.requestBody && !method2.requestBody) {
            this.addChange({
                type: 'Request Body Removed',
                path: `${path}.${method}.requestBody`,
                category: 'removed',
                isBreaking: true,
                details: {
                    required: method1.requestBody.required
                }
            });
        } else if (!method1.requestBody && method2.requestBody) {
            this.addChange({
                type: 'Request Body Added',
                path: `${path}.${method}.requestBody`,
                category: 'added',
                isBreaking: method2.requestBody.required,
                details: {
                    required: method2.requestBody.required
                }
            });
        }
    }

    compareParameters(path, method, params1, params2) {
        const paramMap1 = new Map(params1.map(p => [`${p.name}-${p.in}`, p]));
        const paramMap2 = new Map(params2.map(p => [`${p.name}-${p.in}`, p]));

        // Find removed parameters
        paramMap1.forEach((param, key) => {
            if (!paramMap2.has(key)) {
                this.addChange({
                    type: 'Parameter Removed',
                    path: `${path}.${method}.parameters.${param.name}`,
                    category: 'removed',
                    isBreaking: param.required,
                    details: {
                        name: param.name,
                        in: param.in,
                        required: param.required,
                        type: param.schema?.type
                    }
                });
            }
        });

        // Find added parameters
        paramMap2.forEach((param, key) => {
            if (!paramMap1.has(key)) {
                this.addChange({
                    type: 'Parameter Added',
                    path: `${path}.${method}.parameters.${param.name}`,
                    category: 'added',
                    isBreaking: param.required,
                    details: {
                        name: param.name,
                        in: param.in,
                        required: param.required,
                        type: param.schema?.type
                    }
                });
            } else {
                // Compare existing parameters for changes
                const oldParam = paramMap1.get(key);
                this.compareParameterDetails(path, method, oldParam, param);
            }
        });
    }

    compareResponseDetails(path, method, statusCode, oldResponse, newResponse) {
        const responsePath = `${path}.${method}.responses.${statusCode}`;
        
        // Compare response description
        if (oldResponse.description !== newResponse.description) {
            this.addChange({
                type: 'Response Description Changed',
                path: responsePath,
                category: 'modified',
                isBreaking: false,
                details: {
                    statusCode,
                    change: 'description',
                    old: oldResponse.description,
                    new: newResponse.description
                }
            });
        }

        // Compare response content (media types and schemas)
        const oldContent = oldResponse.content || {};
        const newContent = newResponse.content || {};
        
        const allMediaTypes = new Set([...Object.keys(oldContent), ...Object.keys(newContent)]);
        
        allMediaTypes.forEach(mediaType => {
            if (oldContent[mediaType] && !newContent[mediaType]) {
                this.addChange({
                    type: 'Response Media Type Removed',
                    path: `${responsePath}.content.${mediaType}`,
                    category: 'removed',
                    isBreaking: true,
                    details: {
                        statusCode,
                        mediaType,
                        change: 'content-type removed'
                    }
                });
            } else if (!oldContent[mediaType] && newContent[mediaType]) {
                this.addChange({
                    type: 'Response Media Type Added',
                    path: `${responsePath}.content.${mediaType}`,
                    category: 'added',
                    isBreaking: false,
                    details: {
                        statusCode,
                        mediaType,
                        change: 'content-type added'
                    }
                });
            } else if (oldContent[mediaType] && newContent[mediaType]) {
                // Compare schemas for the same media type
                this.compareResponseSchema(responsePath, statusCode, mediaType, 
                    oldContent[mediaType].schema, newContent[mediaType].schema);
            }
        });

        // Compare response headers
        const oldHeaders = oldResponse.headers || {};
        const newHeaders = newResponse.headers || {};
        
        const allHeaders = new Set([...Object.keys(oldHeaders), ...Object.keys(newHeaders)]);
        
        allHeaders.forEach(headerName => {
            if (oldHeaders[headerName] && !newHeaders[headerName]) {
                this.addChange({
                    type: 'Response Header Removed',
                    path: `${responsePath}.headers.${headerName}`,
                    category: 'removed',
                    isBreaking: true,
                    details: {
                        statusCode,
                        headerName,
                        change: 'header removed'
                    }
                });
            } else if (!oldHeaders[headerName] && newHeaders[headerName]) {
                this.addChange({
                    type: 'Response Header Added',
                    path: `${responsePath}.headers.${headerName}`,
                    category: 'added',
                    isBreaking: false,
                    details: {
                        statusCode,
                        headerName,
                        change: 'header added'
                    }
                });
            }
        });
    }

    compareResponseSchema(responsePath, statusCode, mediaType, oldSchema, newSchema) {
        if (!oldSchema && !newSchema) return;
        
        const schemaPath = `${responsePath}.content.${mediaType}.schema`;
        
        if (oldSchema && !newSchema) {
            this.addChange({
                type: 'Response Schema Removed',
                path: schemaPath,
                category: 'removed',
                isBreaking: true,
                details: {
                    statusCode,
                    mediaType,
                    change: 'schema removed'
                }
            });
            return;
        }
        
        if (!oldSchema && newSchema) {
            this.addChange({
                type: 'Response Schema Added',
                path: schemaPath,
                category: 'added',
                isBreaking: false,
                details: {
                    statusCode,
                    mediaType,
                    change: 'schema added'
                }
            });
            return;
        }

        // Compare schema types
        if (oldSchema.type !== newSchema.type) {
            this.addChange({
                type: 'Response Schema Type Changed',
                path: schemaPath,
                category: 'modified',
                isBreaking: true,
                details: {
                    statusCode,
                    mediaType,
                    change: 'type',
                    old: oldSchema.type,
                    new: newSchema.type
                }
            });
        }

        // Compare schema properties (for object types)
        if (oldSchema.type === 'object' && newSchema.type === 'object') {
            this.compareSchemaObjectProperties(schemaPath, oldSchema, newSchema, statusCode, mediaType);
        }

        // Compare array item schemas
        if (oldSchema.type === 'array' && newSchema.type === 'array') {
            this.compareResponseSchema(schemaPath + '.items', statusCode, mediaType, 
                oldSchema.items, newSchema.items);
        }

        // Compare schema format
        if (oldSchema.format !== newSchema.format) {
            this.addChange({
                type: 'Response Schema Format Changed',
                path: schemaPath,
                category: 'modified',
                isBreaking: this.isFormatChangeBreaking(oldSchema.format, newSchema.format),
                details: {
                    statusCode,
                    mediaType,
                    change: 'format',
                    old: oldSchema.format || 'none',
                    new: newSchema.format || 'none'
                }
            });
        }
    }

    compareSchemaObjectProperties(schemaPath, oldSchema, newSchema, statusCode, mediaType) {
        const oldProps = oldSchema.properties || {};
        const newProps = newSchema.properties || {};
        const oldRequired = oldSchema.required || [];
        const newRequired = newSchema.required || [];
        
        const allProps = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
        
        allProps.forEach(propName => {
            const propPath = `${schemaPath}.properties.${propName}`;
            
            if (oldProps[propName] && !newProps[propName]) {
                this.addChange({
                    type: 'Response Property Removed',
                    path: propPath,
                    category: 'removed',
                    isBreaking: oldRequired.includes(propName),
                    details: {
                        statusCode,
                        mediaType,
                        property: propName,
                        type: oldProps[propName].type,
                        wasRequired: oldRequired.includes(propName)
                    }
                });
            } else if (!oldProps[propName] && newProps[propName]) {
                this.addChange({
                    type: 'Response Property Added',
                    path: propPath,
                    category: 'added',
                    isBreaking: false,
                    details: {
                        statusCode,
                        mediaType,
                        property: propName,
                        type: newProps[propName].type,
                        isRequired: newRequired.includes(propName)
                    }
                });
            } else if (oldProps[propName] && newProps[propName]) {
                // Compare property types
                if (oldProps[propName].type !== newProps[propName].type) {
                    this.addChange({
                        type: 'Response Property Type Changed',
                        path: propPath,
                        category: 'modified',
                        isBreaking: true,
                        details: {
                            statusCode,
                            mediaType,
                            property: propName,
                            change: 'type',
                            old: oldProps[propName].type,
                            new: newProps[propName].type
                        }
                    });
                }
                
                // Recursively compare nested objects
                if (oldProps[propName].type === 'object' && newProps[propName].type === 'object') {
                    this.compareSchemaObjectProperties(propPath, oldProps[propName], newProps[propName], statusCode, mediaType);
                }
            }
        });

        // Check for required property changes
        const removedRequired = oldRequired.filter(r => !newRequired.includes(r));
        const addedRequired = newRequired.filter(r => !oldRequired.includes(r));

        removedRequired.forEach(propName => {
            if (newProps[propName]) {
                this.addChange({
                    type: 'Response Property No Longer Required',
                    path: `${schemaPath}.required`,
                    category: 'modified',
                    isBreaking: false,
                    details: {
                        statusCode,
                        mediaType,
                        property: propName
                    }
                });
            }
        });

        addedRequired.forEach(propName => {
            if (oldProps[propName]) {
                this.addChange({
                    type: 'Response Property Now Required',
                    path: `${schemaPath}.required`,
                    category: 'modified',
                    isBreaking: false, // Adding required to response is not breaking for consumers
                    details: {
                        statusCode,
                        mediaType,
                        property: propName
                    }
                });
            }
        });
    }

    compareParameterDetails(path, method, oldParam, newParam) {
        const paramPath = `${path}.${method}.parameters.${oldParam.name}`;
        
        // Compare required status
        if (oldParam.required !== newParam.required) {
            this.addChange({
                type: 'Parameter Required Status Changed',
                path: paramPath,
                category: 'modified',
                isBreaking: newParam.required && !oldParam.required,
                details: {
                    name: oldParam.name,
                    change: 'required',
                    old: oldParam.required,
                    new: newParam.required
                }
            });
        }

        // Compare parameter schemas
        const oldSchema = oldParam.schema || {};
        const newSchema = newParam.schema || {};
        
        // Compare type
        if (oldSchema.type !== newSchema.type) {
            this.addChange({
                type: 'Parameter Type Changed',
                path: paramPath,
                category: 'modified',
                isBreaking: true,
                details: {
                    name: oldParam.name,
                    change: 'type',
                    old: oldSchema.type,
                    new: newSchema.type
                }
            });
        }

        // Compare format
        if (oldSchema.format !== newSchema.format) {
            this.addChange({
                type: 'Parameter Format Changed',
                path: paramPath,
                category: 'modified',
                isBreaking: this.isFormatChangeBreaking(oldSchema.format, newSchema.format),
                details: {
                    name: oldParam.name,
                    change: 'format',
                    old: oldSchema.format || 'none',
                    new: newSchema.format || 'none'
                }
            });
        }

        // Compare enum values
        if (this.arraysAreDifferent(oldSchema.enum, newSchema.enum)) {
            const removedValues = (oldSchema.enum || []).filter(v => !(newSchema.enum || []).includes(v));
            const addedValues = (newSchema.enum || []).filter(v => !(oldSchema.enum || []).includes(v));
            
            if (removedValues.length > 0 || addedValues.length > 0) {
                this.addChange({
                    type: 'Parameter Enum Values Changed',
                    path: paramPath,
                    category: 'modified',
                    isBreaking: removedValues.length > 0,
                    details: {
                        name: oldParam.name,
                        change: 'enum',
                        removedValues,
                        addedValues,
                        oldEnum: oldSchema.enum,
                        newEnum: newSchema.enum
                    }
                });
            }
        }

        // Compare default values
        if (oldSchema.default !== newSchema.default) {
            this.addChange({
                type: 'Parameter Default Value Changed',
                path: paramPath,
                category: 'modified',
                isBreaking: false,
                details: {
                    name: oldParam.name,
                    change: 'default',
                    old: oldSchema.default,
                    new: newSchema.default
                }
            });
        }

        // Compare constraints
        this.compareParameterConstraints(paramPath, oldParam.name, oldSchema, newSchema);

        // Compare description
        if (oldParam.description !== newParam.description) {
            this.addChange({
                type: 'Parameter Description Changed',
                path: paramPath,
                category: 'modified',
                isBreaking: false,
                details: {
                    name: oldParam.name,
                    change: 'description',
                    old: oldParam.description || '',
                    new: newParam.description || ''
                }
            });
        }
    }

    compareParameterConstraints(paramPath, paramName, oldSchema, newSchema) {
        const constraints = ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern'];
        
        constraints.forEach(constraint => {
            if (oldSchema[constraint] !== newSchema[constraint]) {
                const isBreaking = this.isConstraintChangeBreaking(constraint, oldSchema[constraint], newSchema[constraint]);
                
                this.addChange({
                    type: 'Parameter Constraint Changed',
                    path: paramPath,
                    category: 'modified',
                    isBreaking,
                    details: {
                        name: paramName,
                        change: constraint,
                        old: oldSchema[constraint],
                        new: newSchema[constraint]
                    }
                });
            }
        });
    }

    isFormatChangeBreaking(oldFormat, newFormat) {
        // Some format changes are more breaking than others
        const breakingFormatChanges = {
            'date-time': ['date'],
            'email': ['uri', 'url'],
            'uri': ['email'],
            'uuid': ['string']
        };
        
        return breakingFormatChanges[oldFormat]?.includes(newFormat) || 
               breakingFormatChanges[newFormat]?.includes(oldFormat);
    }

    isConstraintChangeBreaking(constraint, oldValue, newValue) {
        // More restrictive constraints are breaking
        switch (constraint) {
            case 'minimum':
                return newValue > oldValue;
            case 'maximum':
                return newValue < oldValue;
            case 'minLength':
            case 'minItems':
                return newValue > oldValue;
            case 'maxLength':
            case 'maxItems':
                return newValue < oldValue;
            case 'pattern':
                return oldValue !== newValue; // Pattern changes are generally breaking
            default:
                return false;
        }
    }

    arraysAreDifferent(arr1, arr2) {
        if (!arr1 && !arr2) return false;
        if (!arr1 || !arr2) return true;
        if (arr1.length !== arr2.length) return true;
        return !arr1.every(item => arr2.includes(item));
    }

    compareComponents() {
        const components1 = this.spec1.components || {};
        const components2 = this.spec2.components || {};

        // Compare schemas
        this.compareSchemas(components1.schemas || {}, components2.schemas || {});
    }

    compareSchemas(schemas1, schemas2) {
        const allSchemas = new Set([...Object.keys(schemas1), ...Object.keys(schemas2)]);

        allSchemas.forEach(schemaName => {
            if (schemas1[schemaName] && !schemas2[schemaName]) {
                this.addChange({
                    type: 'Schema Removed',
                    path: `components.schemas.${schemaName}`,
                    category: 'removed',
                    isBreaking: true,
                    details: {
                        schemaName
                    }
                });
            } else if (!schemas1[schemaName] && schemas2[schemaName]) {
                this.addChange({
                    type: 'Schema Added',
                    path: `components.schemas.${schemaName}`,
                    category: 'added',
                    isBreaking: false,
                    details: {
                        schemaName
                    }
                });
            } else if (schemas1[schemaName] && schemas2[schemaName]) {
                this.compareSchemaProperties(schemaName, schemas1[schemaName], schemas2[schemaName]);
            }
        });
    }

    compareSchemaProperties(schemaName, schema1, schema2) {
        const props1 = schema1.properties || {};
        const props2 = schema2.properties || {};
        const required1 = schema1.required || [];
        const required2 = schema2.required || [];

        const allProps = new Set([...Object.keys(props1), ...Object.keys(props2)]);

        allProps.forEach(propName => {
            if (props1[propName] && !props2[propName]) {
                this.addChange({
                    type: 'Schema Property Removed',
                    path: `components.schemas.${schemaName}.properties.${propName}`,
                    category: 'removed',
                    isBreaking: required1.includes(propName),
                    details: {
                        schemaName,
                        property: propName,
                        type: props1[propName].type,
                        wasRequired: required1.includes(propName)
                    }
                });
            } else if (!props1[propName] && props2[propName]) {
                this.addChange({
                    type: 'Schema Property Added',
                    path: `components.schemas.${schemaName}.properties.${propName}`,
                    category: 'added',
                    isBreaking: false,
                    details: {
                        schemaName,
                        property: propName,
                        type: props2[propName].type,
                        isRequired: required2.includes(propName)
                    }
                });
            } else if (props1[propName] && props2[propName]) {
                // Compare existing property details
                this.compareSchemaPropertyDetails(schemaName, propName, props1[propName], props2[propName]);
            }
        });

        // Check for changes in required fields
        const removedRequired = required1.filter(r => !required2.includes(r));
        const addedRequired = required2.filter(r => !required1.includes(r));

        removedRequired.forEach(propName => {
            if (props2[propName]) { // Only if property still exists
                this.addChange({
                    type: 'Property No Longer Required',
                    path: `components.schemas.${schemaName}.required`,
                    category: 'modified',
                    isBreaking: false,
                    details: {
                        schemaName,
                        property: propName
                    }
                });
            }
        });

        addedRequired.forEach(propName => {
            if (props1[propName]) { // Only if property existed before
                this.addChange({
                    type: 'Property Now Required',
                    path: `components.schemas.${schemaName}.required`,
                    category: 'modified',
                    isBreaking: true,
                    details: {
                        schemaName,
                        property: propName
                    }
                });
            }
        });
    }

    compareSchemaPropertyDetails(schemaName, propName, oldProp, newProp) {
        const propPath = `components.schemas.${schemaName}.properties.${propName}`;
        
        // Compare property types
        if (oldProp.type !== newProp.type) {
            this.addChange({
                type: 'Schema Property Type Changed',
                path: propPath,
                category: 'modified',
                isBreaking: true,
                details: {
                    schemaName,
                    property: propName,
                    change: 'type',
                    old: oldProp.type,
                    new: newProp.type
                }
            });
        }

        // Compare property formats
        if (oldProp.format !== newProp.format) {
            this.addChange({
                type: 'Schema Property Format Changed',
                path: propPath,
                category: 'modified',
                isBreaking: this.isFormatChangeBreaking(oldProp.format, newProp.format),
                details: {
                    schemaName,
                    property: propName,
                    change: 'format',
                    old: oldProp.format || 'none',
                    new: newProp.format || 'none'
                }
            });
        }

        // Compare enum values
        if (this.arraysAreDifferent(oldProp.enum, newProp.enum)) {
            const removedValues = (oldProp.enum || []).filter(v => !(newProp.enum || []).includes(v));
            const addedValues = (newProp.enum || []).filter(v => !(oldProp.enum || []).includes(v));
            
            if (removedValues.length > 0 || addedValues.length > 0) {
                this.addChange({
                    type: 'Schema Property Enum Changed',
                    path: propPath,
                    category: 'modified',
                    isBreaking: removedValues.length > 0,
                    details: {
                        schemaName,
                        property: propName,
                        change: 'enum',
                        removedValues,
                        addedValues,
                        oldEnum: oldProp.enum,
                        newEnum: newProp.enum
                    }
                });
            }
        }

        // Compare default values
        if (oldProp.default !== newProp.default) {
            this.addChange({
                type: 'Schema Property Default Changed',
                path: propPath,
                category: 'modified',
                isBreaking: false,
                details: {
                    schemaName,
                    property: propName,
                    change: 'default',
                    old: oldProp.default,
                    new: newProp.default
                }
            });
        }

        // Compare property constraints
        const constraints = ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern'];
        
        constraints.forEach(constraint => {
            if (oldProp[constraint] !== newProp[constraint]) {
                const isBreaking = this.isConstraintChangeBreaking(constraint, oldProp[constraint], newProp[constraint]);
                
                this.addChange({
                    type: 'Schema Property Constraint Changed',
                    path: propPath,
                    category: 'modified',
                    isBreaking,
                    details: {
                        schemaName,
                        property: propName,
                        change: constraint,
                        old: oldProp[constraint],
                        new: newProp[constraint]
                    }
                });
            }
        });

        // Compare descriptions
        if (oldProp.description !== newProp.description) {
            this.addChange({
                type: 'Schema Property Description Changed',
                path: propPath,
                category: 'modified',
                isBreaking: false,
                details: {
                    schemaName,
                    property: propName,
                    change: 'description',
                    old: oldProp.description || '',
                    new: newProp.description || ''
                }
            });
        }

        // Recursively compare nested object properties
        if (oldProp.type === 'object' && newProp.type === 'object') {
            const oldProps = oldProp.properties || {};
            const newProps = newProp.properties || {};
            
            const nestedProps = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
            
            nestedProps.forEach(nestedPropName => {
                if (oldProps[nestedPropName] && newProps[nestedPropName]) {
                    this.compareSchemaPropertyDetails(
                        `${schemaName}.${propName}`, 
                        nestedPropName, 
                        oldProps[nestedPropName], 
                        newProps[nestedPropName]
                    );
                } else if (oldProps[nestedPropName] && !newProps[nestedPropName]) {
                    this.addChange({
                        type: 'Nested Property Removed',
                        path: `${propPath}.properties.${nestedPropName}`,
                        category: 'removed',
                        isBreaking: true,
                        details: {
                            schemaName: `${schemaName}.${propName}`,
                            property: nestedPropName,
                            type: oldProps[nestedPropName].type
                        }
                    });
                } else if (!oldProps[nestedPropName] && newProps[nestedPropName]) {
                    this.addChange({
                        type: 'Nested Property Added',
                        path: `${propPath}.properties.${nestedPropName}`,
                        category: 'added',
                        isBreaking: false,
                        details: {
                            schemaName: `${schemaName}.${propName}`,
                            property: nestedPropName,
                            type: newProps[nestedPropName].type
                        }
                    });
                }
            });
        }

        // Compare array item schemas
        if (oldProp.type === 'array' && newProp.type === 'array') {
            if (oldProp.items && newProp.items) {
                this.compareSchemaPropertyDetails(
                    `${schemaName}.${propName}`, 
                    'items', 
                    oldProp.items, 
                    newProp.items
                );
            }
        }
    }

    addChange(change) {
        change.id = Date.now() + Math.random();
        change.timestamp = new Date().toISOString();
        this.changes.push(change);
    }

    displayResults() {
        document.getElementById('resultsSection').style.display = 'block';
        
        // Update statistics
        this.updateStatistics();
        
        // Sort changes chronologically (by order they were detected)
        this.changes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Display changes
        this.renderChanges();
        
        // Scroll to results
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
    }

    updateStatistics() {
        const stats = this.calculateStatistics();
        
        document.getElementById('totalChanges').textContent = stats.total;
        document.getElementById('breakingChanges').textContent = stats.breaking;
        document.getElementById('addedItems').textContent = stats.added;
        document.getElementById('removedItems').textContent = stats.removed;
        document.getElementById('modifiedItems').textContent = stats.modified;
    }

    calculateStatistics() {
        return {
            total: this.changes.length,
            breaking: this.changes.filter(c => c.isBreaking).length,
            added: this.changes.filter(c => c.category === 'added').length,
            removed: this.changes.filter(c => c.category === 'removed').length,
            modified: this.changes.filter(c => c.category === 'modified').length
        };
    }

    renderChanges(filter = 'all') {
        const timeline = document.getElementById('timeline');
        let filteredChanges = this.changes;

        if (filter !== 'all') {
            if (filter === 'breaking') {
                filteredChanges = this.changes.filter(c => c.isBreaking);
            } else {
                filteredChanges = this.changes.filter(c => c.category === filter);
            }
        }

        if (filteredChanges.length === 0) {
            timeline.innerHTML = `
                <div class="no-changes">
                    <div class="no-changes-icon">🎉</div>
                    <h3>No changes found</h3>
                    <p>The API specifications are identical or no changes match the current filter.</p>
                </div>
            `;
            return;
        }

        timeline.innerHTML = filteredChanges.map(change => this.renderChangeItem(change)).join('');
    }

    renderChangeItem(change) {
        const badgeClass = this.getBadgeClass(change);
        const details = this.renderChangeDetails(change);
        
        return `
            <div class="change-item" data-category="${change.category}" data-breaking="${change.isBreaking}">
                <div class="change-header">
                    <div>
                        <div class="change-type">${change.type}</div>
                        <div class="change-path">${change.path}</div>
                    </div>
                    <div class="change-badge ${badgeClass}">
                        ${change.isBreaking ? 'Breaking' : change.category}
                    </div>
                </div>
                ${details}
            </div>
        `;
    }

    getBadgeClass(change) {
        if (change.isBreaking) return 'badge-breaking';
        switch (change.category) {
            case 'added': return 'badge-added';
            case 'removed': return 'badge-removed';
            case 'modified': return 'badge-modified';
            default: return 'badge-modified';
        }
    }

    renderChangeDetails(change) {
        if (!change.details) return '';

        let detailsHtml = '<div class="change-details">';

        // Handle different types of details
        if (change.details.old !== undefined && change.details.new !== undefined) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Changes:</div>
                    <div class="detail-content">
                        <div class="diff-line diff-removed">- ${this.formatValue(change.details.old)}</div>
                        <div class="diff-line diff-added">+ ${this.formatValue(change.details.new)}</div>
                    </div>
                </div>
            `;
        }

        if (change.details.methods && Array.isArray(change.details.methods)) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">HTTP Methods:</div>
                    <div class="detail-content">
                        ${change.details.methods.map(m => m.toUpperCase()).join(', ')}
                    </div>
                </div>
            `;
        }

        if (change.details.method) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Method:</div>
                    <div class="detail-content">${change.details.method.toUpperCase()}</div>
                </div>
            `;
        }

        if (change.details.summary) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Summary:</div>
                    <div class="detail-content">${change.details.summary}</div>
                </div>
            `;
        }

        if (change.details.statusCode) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Status Code:</div>
                    <div class="detail-content">${change.details.statusCode}</div>
                </div>
            `;
        }

        if (change.details.name) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Parameter:</div>
                    <div class="detail-content">
                        <strong>${change.details.name}</strong> (${change.details.in || 'unknown'})
                        ${change.details.required ? ' - Required' : ' - Optional'}
                        ${change.details.type ? ` - Type: ${change.details.type}` : ''}
                    </div>
                </div>
            `;
        }

        if (change.details.property) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Property:</div>
                    <div class="detail-content">
                        <strong>${change.details.property}</strong>
                        ${change.details.type ? ` (${change.details.type})` : ''}
                        ${change.details.isRequired ? ' - Required' : ''}
                        ${change.details.wasRequired ? ' - Was Required' : ''}
                    </div>
                </div>
            `;
        }

        if (change.details.schemaName) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Schema:</div>
                    <div class="detail-content">${change.details.schemaName}</div>
                </div>
            `;
        }

        if (change.details.description) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Description:</div>
                    <div class="detail-content">${change.details.description}</div>
                </div>
            `;
        }

        if (change.details.required !== undefined) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Required:</div>
                    <div class="detail-content">${change.details.required ? 'Yes' : 'No'}</div>
                </div>
            `;
        }

        detailsHtml += '</div>';
        return detailsHtml;
    }

    formatValue(value) {
        if (typeof value === 'string') return `"${value}"`;
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        return String(value);
    }

    filterChanges(filter) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

        // Re-render changes with filter
        this.renderChanges(filter);
    }

    exportMarkdown() {
        if (this.changes.length === 0) {
            alert('No changes to export. Please compare two API specifications first.');
            return;
        }

        const stats = this.calculateStatistics();
        const timestamp = new Date().toISOString().split('T')[0];
        
        let markdown = `# OpenAPI Comparison Report\n\n`;
        markdown += `**Generated on:** ${timestamp}\n\n`;
        
        // Summary
        markdown += `## Summary\n\n`;
        markdown += `- **Total Changes:** ${stats.total}\n`;
        markdown += `- **Breaking Changes:** ${stats.breaking}\n`;
        markdown += `- **Added:** ${stats.added}\n`;
        markdown += `- **Removed:** ${stats.removed}\n`;
        markdown += `- **Modified:** ${stats.modified}\n\n`;

        // Breaking changes first
        const breakingChanges = this.changes.filter(c => c.isBreaking);
        if (breakingChanges.length > 0) {
            markdown += `## ⚠️ Breaking Changes\n\n`;
            breakingChanges.forEach(change => {
                markdown += this.formatChangeForMarkdown(change);
            });
        }

        // Non-breaking changes
        const nonBreakingChanges = this.changes.filter(c => !c.isBreaking);
        if (nonBreakingChanges.length > 0) {
            markdown += `## Changes\n\n`;
            
            const categories = ['added', 'removed', 'modified'];
            categories.forEach(category => {
                const categoryChanges = nonBreakingChanges.filter(c => c.category === category);
                if (categoryChanges.length > 0) {
                    const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
                    markdown += `### ${categoryTitle}\n\n`;
                    categoryChanges.forEach(change => {
                        markdown += this.formatChangeForMarkdown(change);
                    });
                }
            });
        }

        this.downloadFile(markdown, 'api-comparison-report.md', 'text/markdown');
    }

    exportJSON() {
        if (this.changes.length === 0) {
            alert('No changes to export. Please compare two API specifications first.');
            return;
        }

        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                toolVersion: '1.0.0',
                summary: this.calculateStatistics()
            },
            changes: this.changes.map(change => ({
                id: change.id,
                type: change.type,
                path: change.path,
                category: change.category,
                isBreaking: change.isBreaking,
                details: change.details,
                timestamp: change.timestamp
            }))
        };

        this.downloadFile(JSON.stringify(report, null, 2), 'api-comparison-report.json', 'application/json');
    }

    exportHTML() {
        if (this.changes.length === 0) {
            alert('No changes to export. Please compare two API specifications first.');
            return;
        }

        const stats = this.calculateStatistics();
        const timestamp = new Date().toLocaleDateString();
        
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenAPI Comparison Report</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .stats { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
        .stat { background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; flex: 1; min-width: 150px; }
        .stat-number { font-size: 2rem; font-weight: bold; color: #667eea; }
        .change { background: white; border: 1px solid #ddd; border-radius: 10px; padding: 20px; margin-bottom: 15px; }
        .change-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .change-type { font-weight: bold; font-size: 1.1rem; }
        .change-path { color: #666; font-family: monospace; font-size: 0.9rem; }
        .badge { padding: 5px 10px; border-radius: 15px; font-size: 0.8rem; font-weight: bold; }
        .badge-breaking { background: #f8d7da; color: #721c24; }
        .badge-added { background: #e8f5e8; color: #2e7d2e; }
        .badge-removed { background: #ffeaea; color: #d63384; }
        .badge-modified { background: #fff3cd; color: #856404; }
        .details { margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .breaking { border-left: 5px solid #dc3545; }
        .added { border-left: 5px solid #28a745; }
        .removed { border-left: 5px solid #dc3545; }
        .modified { border-left: 5px solid #ffc107; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔄 OpenAPI Comparison Report</h1>
        <p>Generated on ${timestamp}</p>
    </div>
    
    <div class="stats">
        <div class="stat">
            <div class="stat-number">${stats.total}</div>
            <div>Total Changes</div>
        </div>
        <div class="stat">
            <div class="stat-number">${stats.breaking}</div>
            <div>Breaking Changes</div>
        </div>
        <div class="stat">
            <div class="stat-number">${stats.added}</div>
            <div>Added</div>
        </div>
        <div class="stat">
            <div class="stat-number">${stats.removed}</div>
            <div>Removed</div>
        </div>
        <div class="stat">
            <div class="stat-number">${stats.modified}</div>
            <div>Modified</div>
        </div>
    </div>`;

        // Breaking changes first
        const breakingChanges = this.changes.filter(c => c.isBreaking);
        if (breakingChanges.length > 0) {
            html += `<h2>⚠️ Breaking Changes</h2>`;
            breakingChanges.forEach(change => {
                html += this.formatChangeForHTML(change);
            });
        }

        // Non-breaking changes
        const nonBreakingChanges = this.changes.filter(c => !c.isBreaking);
        if (nonBreakingChanges.length > 0) {
            html += `<h2>Changes</h2>`;
            nonBreakingChanges.forEach(change => {
                html += this.formatChangeForHTML(change);
            });
        }

        html += `</body></html>`;

        this.downloadFile(html, 'api-comparison-report.html', 'text/html');
    }

    formatChangeForMarkdown(change) {
        let md = `### ${change.type}\n\n`;
        md += `**Path:** \`${change.path}\`\n\n`;
        md += `**Category:** ${change.category}${change.isBreaking ? ' (Breaking)' : ''}\n\n`;
        
        if (change.details) {
            md += `**Details:**\n`;
            Object.keys(change.details).forEach(key => {
                const value = change.details[key];
                if (value !== undefined && value !== null) {
                    md += `- **${key}:** ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
                }
            });
        }
        
        md += `---\n\n`;
        return md;
    }

    formatChangeForHTML(change) {
        const badgeClass = this.getBadgeClass(change);
        const changeClass = change.isBreaking ? 'breaking' : change.category;
        
        let html = `<div class="change ${changeClass}">
            <div class="change-header">
                <div>
                    <div class="change-type">${change.type}</div>
                    <div class="change-path">${change.path}</div>
                </div>
                <span class="badge ${badgeClass}">
                    ${change.isBreaking ? 'Breaking' : change.category}
                </span>
            </div>`;
        
        if (change.details) {
            html += `<div class="details">`;
            Object.keys(change.details).forEach(key => {
                const value = change.details[key];
                if (value !== undefined && value !== null) {
                    html += `<div><strong>${key}:</strong> ${typeof value === 'object' ? JSON.stringify(value) : value}</div>`;
                }
            });
            html += `</div>`;
        }
        
        html += `</div>`;
        return html;
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize the application
const diffTool = new OpenAPIDiff();

// Add some example data for testing (remove in production)
console.log('OpenAPI Diff Tool initialized. Upload two OpenAPI/Swagger files to compare them.');