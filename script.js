class OpenAPIDiff {
    constructor() {
        this.spec1 = null;
        this.spec2 = null;
        this.changes = [];
        this.originalChanges = null;
        this.currentPathFilter = null;
        this.initializeEventListeners();
    }

    escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    initializeEventListeners() {
        // Input type switching
        document.querySelectorAll('.input-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const inputNumber = e.target.dataset.input;
                const inputType = e.target.dataset.type;
                this.switchInputType(inputNumber, inputType);
            });
        });

        // File upload handling
        ['upload1', 'upload2'].forEach((id, index) => {
            const uploadArea = document.getElementById(id);
            const fileInput = document.getElementById(`file${index + 1}`);
            
            uploadArea.addEventListener('click', (e) => {
                // Don't trigger file input if clicking on URL input or button
                if (e.target.classList.contains('url-input') || 
                    e.target.classList.contains('url-fetch-btn') ||
                    e.target.closest('.url-input-section')) {
                    return;
                }
                fileInput.click();
            });
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

        // URL fetch buttons
        document.getElementById('fetchBtn1').addEventListener('click', (e) => {
            e.stopPropagation();
            this.fetchFromUrl(1);
        });
        document.getElementById('fetchBtn2').addEventListener('click', (e) => {
            e.stopPropagation();
            this.fetchFromUrl(2);
        });
        
        // URL input event handlers
        ['url1', 'url2'].forEach((id, index) => {
            const urlInput = document.getElementById(id);
            
            // Prevent parent click handler when focusing/clicking URL input
            urlInput.addEventListener('click', (e) => e.stopPropagation());
            urlInput.addEventListener('focus', (e) => e.stopPropagation());
            
            // Enter key support
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.fetchFromUrl(index + 1);
            });
        });
        
        // Heatmap toggle button
        document.getElementById('heatmapToggle').addEventListener('click', () => this.toggleHeatmap());
        
        // Version suggestion toggle button
        document.getElementById('versionToggle').addEventListener('click', () => this.toggleVersionDetails());
        
        // Advanced tools toggle
        document.getElementById('advancedToolsToggle').addEventListener('click', () => this.toggleAdvancedTools());
        
        // Advanced tools buttons
        document.getElementById('versionDetailsBtn').addEventListener('click', () => this.toggleVersionDetails());
        document.getElementById('showHeatmapBtn').addEventListener('click', () => this.toggleHeatmap());
        
        // Advanced tools export buttons (compact versions)
        document.getElementById('exportMarkdownCompact').addEventListener('click', () => this.exportMarkdownCompact());
        document.getElementById('exportJSONCompact').addEventListener('click', () => this.exportJSONCompact());
        document.getElementById('exportHTMLCompact').addEventListener('click', () => this.exportHTMLCompact());
        
        // Clear filter button (near timeline)
        document.getElementById('clearFilter').addEventListener('click', () => this.clearPathFilter());
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('dragover');
    }

    switchInputType(inputNumber, inputType) {
        // Update buttons for this input
        document.querySelectorAll(`[data-input="${inputNumber}"]`).forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-input="${inputNumber}"][data-type="${inputType}"]`).classList.add('active');

        // Update content visibility for this input
        document.querySelectorAll(`#fileInput${inputNumber}, #urlInput${inputNumber}`).forEach(methodEl => {
            methodEl.classList.remove('active');
        });
        document.getElementById(`${inputType}Input${inputNumber}`).classList.add('active');
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
        // Show loading spinner
        this.showFileLoading(fileNumber, 'Reading file...');
        
        try {
            // Small delay to show loading state
            await new Promise(resolve => setTimeout(resolve, 100));
            
            this.updateFileLoadingText(fileNumber, 'Parsing content...');
            const content = await this.readFile(file);
            let parsed;
            
            if (file.name.endsWith('.json')) {
                this.updateFileLoadingText(fileNumber, 'Parsing JSON...');
                parsed = JSON.parse(content);
            } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
                this.updateFileLoadingText(fileNumber, 'Parsing YAML...');
                parsed = jsyaml.load(content);
            } else {
                throw new Error('Unsupported file format');
            }

            this.updateFileLoadingText(fileNumber, 'Validating structure...');
            await new Promise(resolve => setTimeout(resolve, 200));

            if (fileNumber === 1) {
                this.spec1 = parsed;
            } else {
                this.spec2 = parsed;
            }

            this.hideFileLoading(fileNumber);
            this.updateFileInfo(file, fileNumber, parsed);
            this.updateCompareButton();
        } catch (error) {
            this.hideFileLoading(fileNumber);
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
        
        if (info) {
            info.innerHTML = `
                <strong>${this.escapeHtml(file.name)}</strong><br>
                Version: ${this.escapeHtml(version)}<br>
                Paths: ${pathCount}<br>
                Size: ${(file.size / 1024).toFixed(1)} KB
            `;
            info.style.display = 'block';
        }
    }

    updateUrlInfo(url, fileNumber, spec) {
        const info = document.getElementById(`urlInfo${fileNumber}`);
        const pathCount = this.countPaths(spec);
        const version = spec.info?.version || 'Unknown';
        const urlObj = new URL(url);
        const filename = urlObj.pathname.split('/').pop() || 'api-spec';
        
        if (info) {
            info.innerHTML = `
                <strong>${this.escapeHtml(filename)}</strong><br>
                Version: ${this.escapeHtml(version)}<br>
                Paths: ${pathCount}<br>
                Source: ${this.escapeHtml(urlObj.hostname)}
            `;
            info.style.display = 'block';
        }
    }

    async fetchFromUrl(fileNumber) {
        const urlInput = document.getElementById(`url${fileNumber}`);
        const url = urlInput.value.trim();
        
        if (!url) {
            alert('Please enter a URL');
            return;
        }

        if (!this.isValidUrl(url)) {
            alert('Please enter a valid URL (must start with http:// or https://)');
            return;
        }

        this.showFileLoading(fileNumber, 'Fetching from URL...');

        try {
            this.updateFileLoadingText(fileNumber, 'Downloading specification...');
            
            // Fetch the content from the URL
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, application/x-yaml, text/yaml, text/plain, */*'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.updateFileLoadingText(fileNumber, 'Reading response...');
            const content = await response.text();
            const contentLength = content.length;

            this.updateFileLoadingText(fileNumber, 'Parsing content...');
            let parsed;

            // Try to determine format and parse accordingly
            const contentType = response.headers.get('content-type') || '';
            const urlLower = url.toLowerCase();
            
            if (contentType.includes('json') || urlLower.includes('.json') || content.trim().startsWith('{')) {
                this.updateFileLoadingText(fileNumber, 'Parsing JSON...');
                parsed = JSON.parse(content);
            } else if (contentType.includes('yaml') || contentType.includes('yml') || 
                       urlLower.includes('.yaml') || urlLower.includes('.yml') || 
                       content.includes('openapi:') || content.includes('swagger:')) {
                this.updateFileLoadingText(fileNumber, 'Parsing YAML...');
                parsed = jsyaml.load(content);
            } else {
                // Try JSON first, then YAML
                try {
                    parsed = JSON.parse(content);
                } catch {
                    parsed = jsyaml.load(content);
                }
            }

            this.updateFileLoadingText(fileNumber, 'Validating OpenAPI specification...');
            await new Promise(resolve => setTimeout(resolve, 200));

            // Basic validation
            if (!parsed || typeof parsed !== 'object') {
                throw new Error('Invalid OpenAPI specification format');
            }

            if (!parsed.openapi && !parsed.swagger) {
                throw new Error('Not a valid OpenAPI/Swagger specification (missing openapi or swagger field)');
            }

            if (fileNumber === 1) {
                this.spec1 = parsed;
            } else {
                this.spec2 = parsed;
            }

            this.hideFileLoading(fileNumber);
            this.updateUrlInfo(url, fileNumber, parsed);
            this.updateCompareButton();
            
            // Clear the URL input after successful fetch
            urlInput.value = '';

        } catch (error) {
            this.hideFileLoading(fileNumber);
            
            let errorMessage = 'Error fetching URL: ';
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage += 'Network error or CORS policy. The URL might not allow cross-origin requests.';
            } else if (error.name === 'SyntaxError') {
                errorMessage += 'Invalid JSON/YAML format in the response.';
            } else {
                errorMessage += error.message;
            }
            
            alert(errorMessage);
        }
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
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
        btn.innerHTML = '<div class="loading-spinner"></div> Starting comparison...';
        btn.disabled = true;

        // Show progress UI
        this.showComparisonProgress();
        
        try {
            this.changes = [];
            
            // Step 1: Compare info sections
            this.updateProgress(1, 'Analyzing API info sections...');
            await new Promise(resolve => setTimeout(resolve, 300));
            this.compareInfo();
            
            // Step 2: Compare paths
            this.updateProgress(2, 'Comparing paths and endpoints...');
            await new Promise(resolve => setTimeout(resolve, 500));
            this.comparePaths();
            
            // Step 3: Compare components
            this.updateProgress(3, 'Checking schemas and components...');
            await new Promise(resolve => setTimeout(resolve, 400));
            this.compareComponents();
            
            // Step 4: Generate results
            this.updateProgress(4, 'Generating comparison results...');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            this.hideComparisonProgress();
            this.displayResults();
        } catch (error) {
            this.hideComparisonProgress();
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
        
        // Note: Compact export listeners removed - using advanced tools panel now
        
        // Update statistics
        this.updateStatistics();
        
        // Sort changes chronologically (by order they were detected)
        this.changes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Display changes
        this.renderChanges();
        
        // Scroll to results
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
    }

    // Removed setupCompactExportListeners - using advanced tools panel now

    updateStatistics() {
        const stats = this.calculateStatistics();
        
        document.getElementById('totalChanges').textContent = stats.total;
        document.getElementById('breakingChanges').textContent = stats.breaking;
        document.getElementById('addedItems').textContent = stats.added;
        document.getElementById('removedItems').textContent = stats.removed;
        document.getElementById('modifiedItems').textContent = stats.modified;
        
        // Update version suggestion
        this.updateVersionSuggestion(stats.suggestedVersion);
        
        // Update compact version suggestion in advanced tools
        this.updateCompactVersionSuggestion(stats.suggestedVersion);
        
        // Update heatmap
        this.updateHeatmap();
    }

    updateVersionSuggestion(versionInfo) {
        const suggestionEl = document.getElementById('versionSuggestion');
        const badgeEl = document.getElementById('versionBadge');
        const descriptionEl = document.getElementById('versionDescription');
        const changeListEl = document.getElementById('versionChangeList');
        
        // Don't auto-show the full version suggestion - keep it hidden
        // It will only be shown when user clicks "Details" from Advanced Tools
        suggestionEl.style.display = 'none';
        
        if (!versionInfo || versionInfo.level === 'none') {
            return;
        }
        
        // Update badge
        badgeEl.textContent = versionInfo.level.toUpperCase();
        badgeEl.className = `version-badge ${versionInfo.level}`;
        
        // Update description
        descriptionEl.textContent = `${versionInfo.suggestion} - ${versionInfo.description}`;
        
        // Update change list
        changeListEl.innerHTML = '';
        if (versionInfo.details && versionInfo.details.length > 0) {
            versionInfo.details.forEach(detail => {
                const changeItem = document.createElement('div');
                changeItem.className = 'version-change-item';
                
                changeItem.innerHTML = `
                    <div class="version-change-type">${this.escapeHtml(detail.type)}</div>
                    ${detail.path ? `<div class="version-change-path">${this.escapeHtml(detail.path)}</div>` : ''}
                    <div class="version-change-description">${this.escapeHtml(detail.description)}</div>
                `;
                
                changeListEl.appendChild(changeItem);
            });
        }
    }

    updateCompactVersionSuggestion(versionInfo) {
        const compactEl = document.getElementById('versionSuggestionCompact');
        const badgeEl = document.getElementById('versionBadgeCompact');
        const descEl = document.getElementById('versionDescriptionCompact');
        
        if (!versionInfo || versionInfo.level === 'none') {
            compactEl.style.display = 'none';
            return;
        }

        // Show the compact suggestion
        compactEl.style.display = 'flex';
        
        // Update badge
        badgeEl.textContent = versionInfo.level.toUpperCase();
        badgeEl.className = `version-badge ${versionInfo.level}`;
        
        // Update description
        descEl.textContent = versionInfo.description;
    }

    toggleHeatmap() {
        const toggle = document.getElementById('heatmapToggle');
        const content = document.getElementById('heatmapContent');
        const icon = toggle.querySelector('.toggle-icon');
        const text = toggle.querySelector('.toggle-text');
        
        if (content.classList.contains('collapsed')) {
            // Show heatmap
            content.classList.remove('collapsed');
            toggle.classList.remove('collapsed');
            icon.textContent = '▼';
            text.textContent = 'Hide Heatmap';
        } else {
            // Hide heatmap
            content.classList.add('collapsed');
            toggle.classList.add('collapsed');
            icon.textContent = '▶';
            text.textContent = 'Show Heatmap';
        }
    }

    toggleVersionDetails() {
        const toggle = document.getElementById('versionToggle');
        const details = document.getElementById('versionDetails');
        const icon = toggle.querySelector('.toggle-icon');
        const text = toggle.querySelector('.toggle-text');
        
        if (details.classList.contains('collapsed')) {
            // Show details
            details.classList.remove('collapsed');
            toggle.classList.remove('collapsed');
            icon.textContent = '▼';
            text.textContent = 'Hide Details';
        } else {
            // Hide details
            details.classList.add('collapsed');
            toggle.classList.add('collapsed');
            icon.textContent = '▶';
            text.textContent = 'Show Details';
        }
    }

    toggleAdvancedTools() {
        const toggle = document.getElementById('advancedToolsToggle');
        const panel = document.getElementById('advancedToolsPanel');
        const arrow = toggle.querySelector('.toggle-arrow');
        
        if (panel.classList.contains('collapsed')) {
            // Show panel
            panel.classList.remove('collapsed');
            toggle.classList.remove('collapsed');
            arrow.textContent = '▼';
        } else {
            // Hide panel
            panel.classList.add('collapsed');
            toggle.classList.add('collapsed');
            arrow.textContent = '▶';
        }
    }

    toggleVersionDetails() {
        const versionSection = document.getElementById('versionSuggestion');
        const btn = document.getElementById('versionDetailsBtn');
        
        if (versionSection.style.display === 'none' || !versionSection.style.display) {
            // Show the version section
            versionSection.style.display = 'block';
            btn.textContent = 'Hide Details';
            
            // Expand the details by default when showing
            const versionDetails = document.getElementById('versionDetails');
            const versionToggle = document.getElementById('versionToggle');
            versionDetails.classList.remove('collapsed');
            versionToggle.classList.remove('collapsed');
            versionToggle.querySelector('.toggle-icon').textContent = '▼';
            versionToggle.querySelector('.toggle-text').textContent = 'Hide Details';
            
            versionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            // Hide the version section
            versionSection.style.display = 'none';
            btn.textContent = 'View Details';
        }
    }

    toggleHeatmap() {
        const heatmapSection = document.getElementById('heatmapSection');
        const btn = document.getElementById('showHeatmapBtn');
        
        if (heatmapSection.style.display === 'none' || !heatmapSection.style.display) {
            // Show the heatmap section
            heatmapSection.style.display = 'block';
            btn.textContent = 'Hide Heatmap';
            
            // Expand the heatmap by default when showing
            const heatmapContent = document.getElementById('heatmapContent');
            const heatmapToggle = document.getElementById('heatmapToggle');
            heatmapContent.classList.remove('collapsed');
            heatmapToggle.classList.remove('collapsed');
            heatmapToggle.querySelector('.toggle-icon').textContent = '▼';
            heatmapToggle.querySelector('.toggle-text').textContent = 'Hide Heatmap';
            
            heatmapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            // Hide the heatmap section
            heatmapSection.style.display = 'none';
            btn.textContent = 'Show Heatmap';
        }
    }

    updateHeatmap() {
        if (this.changes.length === 0) {
            document.getElementById('heatmapSection').style.display = 'none';
            return;
        }

        // Keep heatmap section hidden by default - only show when user requests it
        document.getElementById('heatmapSection').style.display = 'none';
        
        // Generate heatmap data
        const heatmapData = this.generateHeatmapData();
        
        // Render heatmap
        this.renderHeatmap(heatmapData);
        
        // Update heatmap statistics
        this.updateHeatmapStats(heatmapData);
    }

    generateHeatmapData() {
        // Create a map to store path data
        const pathMap = new Map();
        
        // Collect all unique paths from both specs
        const allPaths = new Set();
        if (this.spec1 && this.spec1.paths) {
            Object.keys(this.spec1.paths).forEach(path => allPaths.add(path));
        }
        if (this.spec2 && this.spec2.paths) {
            Object.keys(this.spec2.paths).forEach(path => allPaths.add(path));
        }

        // Initialize path data
        allPaths.forEach(path => {
            const spec1Methods = this.spec1 && this.spec1.paths && this.spec1.paths[path] 
                ? Object.keys(this.spec1.paths[path]).filter(k => k !== 'parameters')
                : [];
            const spec2Methods = this.spec2 && this.spec2.paths && this.spec2.paths[path]
                ? Object.keys(this.spec2.paths[path]).filter(k => k !== 'parameters')
                : [];
            
            const allMethods = new Set([...spec1Methods, ...spec2Methods]);
            
            pathMap.set(path, {
                path: path,
                methods: Array.from(allMethods),
                changes: [],
                changeCount: 0,
                hasBreaking: false,
                status: this.getPathStatus(path)
            });
        });

        // Analyze changes and assign to paths
        this.changes.forEach(change => {
            const pathKey = this.extractPathFromChange(change);
            if (pathKey && pathMap.has(pathKey)) {
                const pathData = pathMap.get(pathKey);
                pathData.changes.push(change);
                pathData.changeCount++;
                if (change.isBreaking) {
                    pathData.hasBreaking = true;
                }
            }
        });

        return Array.from(pathMap.values()).sort((a, b) => {
            // Sort by change count (descending), then by path name
            if (a.changeCount !== b.changeCount) {
                return b.changeCount - a.changeCount;
            }
            return a.path.localeCompare(b.path);
        });
    }

    extractPathFromChange(change) {
        // Extract the API path from the change path
        const changePath = change.path;
        
        // Handle different types of change paths
        if (changePath.startsWith('/')) {
            // Direct path change like "/pets" or "/pets/{petId}"
            const pathParts = changePath.split('.');
            return pathParts[0];
        } else if (changePath.includes('paths.')) {
            // Change path like "paths./pets.get" or similar
            const match = changePath.match(/paths\.([^.]+)/);
            return match ? match[1] : null;
        } else {
            // Try to extract from the path structure
            const pathMatch = changePath.match(/^(\/[^.]+)/);
            return pathMatch ? pathMatch[1] : null;
        }
    }

    getPathStatus(path) {
        const inSpec1 = this.spec1 && this.spec1.paths && this.spec1.paths[path];
        const inSpec2 = this.spec2 && this.spec2.paths && this.spec2.paths[path];
        
        if (inSpec1 && inSpec2) return 'modified';
        if (inSpec1 && !inSpec2) return 'removed';
        if (!inSpec1 && inSpec2) return 'added';
        return 'unchanged';
    }

    getChangeIntensity(changeCount) {
        if (changeCount === 0) return 'no-changes';
        if (changeCount <= 2) return 'low-changes';
        if (changeCount <= 5) return 'medium-changes';
        return 'high-changes';
    }

    renderHeatmap(heatmapData) {
        const grid = document.getElementById('heatmapGrid');
        grid.innerHTML = '';

        heatmapData.forEach(pathData => {
            const cell = document.createElement('div');
            cell.className = `heatmap-cell ${this.getChangeIntensity(pathData.changeCount)}`;
            cell.dataset.path = pathData.path;
            
            cell.innerHTML = `
                <div class="heatmap-cell-path">${this.escapeHtml(pathData.path)}</div>
                <div class="heatmap-cell-methods">
                    ${pathData.methods.map(method => 
                        `<span class="heatmap-method-tag ${this.escapeHtml(method.toLowerCase())}">${this.escapeHtml(method)}</span>`
                    ).join('')}
                </div>
                <div class="heatmap-cell-changes">
                    ${pathData.changeCount} change${pathData.changeCount !== 1 ? 's' : ''}
                </div>
                ${pathData.hasBreaking ? '<div class="heatmap-cell-indicator breaking"></div>' : ''}
            `;

            // Add click event to filter timeline by path
            cell.addEventListener('click', () => this.filterTimelineByPath(pathData.path));
            
            // Add hover tooltip
            cell.title = this.generateCellTooltip(pathData);

            grid.appendChild(cell);
        });
    }

    generateCellTooltip(pathData) {
        let tooltip = `Path: ${pathData.path}\n`;
        tooltip += `Methods: ${pathData.methods.join(', ')}\n`;
        tooltip += `Changes: ${pathData.changeCount}\n`;
        
        if (pathData.hasBreaking) {
            tooltip += 'Contains breaking changes\n';
        }
        
        if (pathData.changes.length > 0) {
            tooltip += '\nRecent changes:\n';
            pathData.changes.slice(0, 3).forEach(change => {
                tooltip += `• ${change.type}\n`;
            });
            if (pathData.changes.length > 3) {
                tooltip += `• ... and ${pathData.changes.length - 3} more\n`;
            }
        }
        
        return tooltip;
    }

    filterTimelineByPath(path) {
        // Filter the timeline to show only changes for this path
        const filteredChanges = this.changes.filter(change => {
            const changePath = this.extractPathFromChange(change);
            return changePath === path;
        });

        if (filteredChanges.length > 0) {
            // Store original changes if not already stored
            if (!this.originalChanges) {
                this.originalChanges = [...this.changes];
            }
            
            // Set current filter
            this.currentPathFilter = path;
            this.changes = filteredChanges;
            
            // Show filter status indicator
            this.showFilterStatus(`Filtering: ${path}`, filteredChanges.length);
            
            // Update filter buttons to show we're filtering
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            
            // Re-render timeline with filtered changes
            this.renderChanges();
            
            // Scroll to timeline
            document.getElementById('timeline').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    clearPathFilter() {
        if (this.originalChanges) {
            // Restore original changes
            this.changes = [...this.originalChanges];
            this.originalChanges = null;
            this.currentPathFilter = null;
            
            // Hide filter status indicator
            this.hideFilterStatus();
            
            // Reset filter buttons to "all"
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('[data-filter="all"]').classList.add('active');
            
            // Re-render timeline
            this.renderChanges();
            
            // Show cleared notification
            this.showClearFilterNotification();
        }
    }

    showFilterStatus(text, count) {
        const statusEl = document.getElementById('filterStatus');
        const textEl = document.getElementById('filterStatusText');
        
        textEl.textContent = `${text} (${count} change${count !== 1 ? 's' : ''})`;
        statusEl.style.display = 'block';
    }

    hideFilterStatus() {
        document.getElementById('filterStatus').style.display = 'none';
    }


    showClearFilterNotification() {
        // Create and show a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success-color);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 500;
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        `;
        notification.textContent = `Showing all changes`;
        
        document.body.appendChild(notification);
        
        // Remove notification after 2 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 2000);
    }

    updateHeatmapStats(heatmapData) {
        const statsEl = document.getElementById('heatmapStats');
        
        const totalPaths = heatmapData.length;
        const changedPaths = heatmapData.filter(p => p.changeCount > 0).length;
        const breakingPaths = heatmapData.filter(p => p.hasBreaking).length;
        const mostChangedPath = heatmapData.length > 0 ? heatmapData[0] : null;
        
        statsEl.innerHTML = `
            <div class="heatmap-stat">
                <span class="heatmap-stat-number">${totalPaths}</span>
                <div class="heatmap-stat-label">Total Endpoints</div>
            </div>
            <div class="heatmap-stat">
                <span class="heatmap-stat-number">${changedPaths}</span>
                <div class="heatmap-stat-label">Modified Endpoints</div>
            </div>
            <div class="heatmap-stat">
                <span class="heatmap-stat-number">${breakingPaths}</span>
                <div class="heatmap-stat-label">With Breaking Changes</div>
            </div>
            <div class="heatmap-stat">
                <span class="heatmap-stat-number">${Math.round((changedPaths / totalPaths) * 100)}%</span>
                <div class="heatmap-stat-label">Coverage</div>
            </div>
        `;
    }

    calculateStatistics() {
        const stats = {
            total: this.changes.length,
            breaking: this.changes.filter(c => c.isBreaking).length,
            added: this.changes.filter(c => c.category === 'added').length,
            removed: this.changes.filter(c => c.category === 'removed').length,
            modified: this.changes.filter(c => c.category === 'modified').length
        };
        
        // Add semantic versioning suggestion
        stats.suggestedVersion = this.calculateSemanticVersion();
        
        return stats;
    }

    calculateSemanticVersion() {
        if (this.changes.length === 0) {
            return {
                level: 'none',
                suggestion: 'No changes detected',
                description: 'No version bump needed'
            };
        }

        // Check for breaking changes (MAJOR version)
        const breakingChanges = this.changes.filter(c => c.isBreaking);
        if (breakingChanges.length > 0) {
            return {
                level: 'major',
                suggestion: 'Major version bump (X.y.z)',
                description: `${breakingChanges.length} breaking change${breakingChanges.length > 1 ? 's' : ''} detected`,
                details: this.getBreakingChangeDetails(breakingChanges)
            };
        }

        // Check for new functionality (MINOR version)
        const addedFeatures = this.changes.filter(c => this.isFeatureAddition(c));
        if (addedFeatures.length > 0) {
            return {
                level: 'minor',
                suggestion: 'Minor version bump (x.Y.z)',
                description: `${addedFeatures.length} new feature${addedFeatures.length > 1 ? 's' : ''} added`,
                details: this.getFeatureAdditionDetails(addedFeatures)
            };
        }

        // Everything else is PATCH (bug fixes, documentation, etc.)
        const patchChanges = this.changes.filter(c => this.isPatchChange(c));
        if (patchChanges.length > 0) {
            return {
                level: 'patch',
                suggestion: 'Patch version bump (x.y.Z)',
                description: `${patchChanges.length} patch-level change${patchChanges.length > 1 ? 's' : ''} detected`,
                details: this.getPatchChangeDetails(patchChanges)
            };
        }

        return {
            level: 'patch',
            suggestion: 'Patch version bump (x.y.Z)',
            description: 'Minor changes detected',
            details: []
        };
    }

    isFeatureAddition(change) {
        // Feature additions that warrant a minor version bump
        const featureTypes = [
            'Path Added',
            'GET Method Added',
            'POST Method Added', 
            'PUT Method Added',
            'DELETE Method Added',
            'PATCH Method Added',
            'Schema Added',
            'Response Added',
            'Parameter Added' // Only if not required
        ];

        return featureTypes.includes(change.type) && !change.isBreaking;
    }

    isPatchChange(change) {
        // Changes that are typically patch-level
        const patchTypes = [
            'Version Change',
            'Title Change',
            'Parameter Description Changed',
            'Response Description Changed',
            'Schema Property Description Changed',
            'Schema Property Default Changed',
            'Property No Longer Required' // Making things less strict
        ];

        return patchTypes.includes(change.type) || 
               (change.category === 'modified' && !change.isBreaking);
    }

    getBreakingChangeDetails(breakingChanges) {
        const details = breakingChanges.slice(0, 5).map(change => ({
            type: change.type,
            path: change.path,
            description: this.getChangeDescription(change)
        }));

        if (breakingChanges.length > 5) {
            details.push({
                type: 'Additional Changes',
                path: '',
                description: `... and ${breakingChanges.length - 5} more breaking changes`
            });
        }

        return details;
    }

    getFeatureAdditionDetails(addedFeatures) {
        const details = addedFeatures.slice(0, 5).map(change => ({
            type: change.type,
            path: change.path,
            description: this.getChangeDescription(change)
        }));

        if (addedFeatures.length > 5) {
            details.push({
                type: 'Additional Features',
                path: '',
                description: `... and ${addedFeatures.length - 5} more new features`
            });
        }

        return details;
    }

    getPatchChangeDetails(patchChanges) {
        const details = patchChanges.slice(0, 3).map(change => ({
            type: change.type,
            path: change.path,
            description: this.getChangeDescription(change)
        }));

        if (patchChanges.length > 3) {
            details.push({
                type: 'Additional Changes',
                path: '',
                description: `... and ${patchChanges.length - 3} more patch changes`
            });
        }

        return details;
    }

    getChangeDescription(change) {
        if (change.details) {
            if (change.details.old !== undefined && change.details.new !== undefined) {
                return `Changed from "${change.details.old}" to "${change.details.new}"`;
            }
            if (change.details.methods) {
                return `Methods: ${change.details.methods.join(', ')}`;
            }
            if (change.details.name) {
                return `Parameter: ${change.details.name}`;
            }
            if (change.details.property) {
                return `Property: ${change.details.property}`;
            }
        }
        return change.type;
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
                        <div class="change-type">${this.escapeHtml(change.type)}</div>
                        <div class="change-path">${this.escapeHtml(change.path)}</div>
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
                        ${change.details.methods.map(m => this.escapeHtml(m.toUpperCase())).join(', ')}
                    </div>
                </div>
            `;
        }

        if (change.details.method) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Method:</div>
                    <div class="detail-content">${this.escapeHtml(change.details.method.toUpperCase())}</div>
                </div>
            `;
        }

        if (change.details.summary) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Summary:</div>
                    <div class="detail-content">${this.escapeHtml(change.details.summary)}</div>
                </div>
            `;
        }

        if (change.details.statusCode) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Status Code:</div>
                    <div class="detail-content">${this.escapeHtml(change.details.statusCode)}</div>
                </div>
            `;
        }

        if (change.details.name) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Parameter:</div>
                    <div class="detail-content">
                        <strong>${this.escapeHtml(change.details.name)}</strong> (${this.escapeHtml(change.details.in || 'unknown')})
                        ${change.details.required ? ' - Required' : ' - Optional'}
                        ${change.details.type ? ` - Type: ${this.escapeHtml(change.details.type)}` : ''}
                    </div>
                </div>
            `;
        }

        if (change.details.property) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Property:</div>
                    <div class="detail-content">
                        <strong>${this.escapeHtml(change.details.property)}</strong>
                        ${change.details.type ? ` (${this.escapeHtml(change.details.type)})` : ''}
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
                    <div class="detail-content">${this.escapeHtml(change.details.schemaName)}</div>
                </div>
            `;
        }

        if (change.details.description) {
            detailsHtml += `
                <div class="detail-section">
                    <div class="detail-title">Description:</div>
                    <div class="detail-content">${this.escapeHtml(change.details.description)}</div>
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
        if (typeof value === 'string') return this.escapeHtml(`"${value}"`);
        if (typeof value === 'object') return this.escapeHtml(JSON.stringify(value, null, 2));
        return this.escapeHtml(String(value));
    }

    filterChanges(filter) {
        // Clear any path filter first
        if (this.currentPathFilter) {
            this.clearPathFilter();
        }
        
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
    <title>OpenAPI Comparison Report - stefandango.dev</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-color: #0078d4;
            --secondary-color: #1e40af;
            --accent-color: #0078d4;
            --accent-hover: #1e40af;
            --success-color: #38a169;
            --warning-color: #f59e0b;
            --danger-color: #e53e3e;
            --background: linear-gradient(135deg, #0a0e1a 0%, #1a1f2e 50%, #0f1419 100%);
            --surface: rgba(20, 25, 35, 0.95);
            --surface-secondary: rgba(15, 15, 25, 0.9);
            --text-primary: #f0f4f8;
            --text-secondary: #e0e6ed;
            --text-muted: #d1d8e0;
            --border-color: rgba(0, 120, 212, 0.4);
            --border-color-subtle: rgba(0, 120, 212, 0.2);
            --shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2);
            --shadow-lg: 0 4px 16px rgba(0, 120, 212, 0.15), 0 6px 20px rgba(0, 0, 0, 0.4);
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: var(--background);
            background-attachment: fixed;
            min-height: 100vh;
            padding: 20px;
            color: var(--text-primary);
            line-height: 1.6;
            margin: 0;
        }
        
        .header {
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            color: var(--text-primary);
            padding: 40px;
            text-align: center;
            position: relative;
            border-radius: 15px;
            margin-bottom: 30px;
            box-shadow: var(--shadow-lg);
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(0, 120, 212, 0.1), rgba(30, 64, 175, 0.1));
            backdrop-filter: blur(10px);
            border-radius: 15px;
        }
        
        .header > * { position: relative; z-index: 1; }
        
        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 20px;
        }
        
        .brand-link {
            color: var(--text-primary);
            text-decoration: none;
            font-size: 0.9rem;
            opacity: 0.8;
            transition: opacity 0.2s ease;
        }
        
        .brand-link:hover { opacity: 1; }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .stat {
            background: var(--surface-secondary);
            border: 1px solid var(--border-color-subtle);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            backdrop-filter: blur(10px);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            box-shadow: var(--shadow);
        }
        
        .stat:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-lg);
        }
        
        .stat-number {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--accent-color);
            margin-bottom: 5px;
            display: block;
        }
        
        .stat-label { 
            color: var(--text-secondary);
            font-weight: 500;
        }
        
        h2 {
            font-size: 1.8rem;
            font-weight: 600;
            color: var(--text-primary);
            margin: 40px 0 25px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--border-color);
        }
        
        .change {
            background: var(--surface-secondary);
            border: 1px solid var(--border-color-subtle);
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 20px;
            backdrop-filter: blur(10px);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            box-shadow: var(--shadow);
        }
        
        .change:hover {
            transform: translateY(-1px);
            box-shadow: var(--shadow-lg);
        }
        
        .change-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .change-type {
            font-weight: 600;
            font-size: 1.2rem;
            color: var(--text-primary);
        }
        
        .change-path {
            color: var(--text-muted);
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
            font-size: 0.9rem;
            background: rgba(0, 120, 212, 0.1);
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid var(--border-color-subtle);
        }
        
        .badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .badge-breaking {
            background: rgba(229, 62, 62, 0.2);
            color: #ff6b6b;
            border: 1px solid rgba(229, 62, 62, 0.3);
        }
        
        .badge-added {
            background: rgba(56, 161, 105, 0.2);
            color: #68d391;
            border: 1px solid rgba(56, 161, 105, 0.3);
        }
        
        .badge-removed {
            background: rgba(229, 62, 62, 0.2);
            color: #ff6b6b;
            border: 1px solid rgba(229, 62, 62, 0.3);
        }
        
        .badge-modified {
            background: rgba(245, 158, 11, 0.2);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
        }
        
        .details {
            margin-top: 20px;
            padding: 20px;
            background: rgba(0, 120, 212, 0.05);
            border-radius: 10px;
            border: 1px solid var(--border-color-subtle);
        }
        
        .details pre {
            background: rgba(0, 0, 0, 0.3);
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
            font-size: 0.85rem;
            color: var(--text-secondary);
            border: 1px solid var(--border-color-subtle);
        }
        
        .breaking { border-left: 4px solid var(--danger-color); }
        .added { border-left: 4px solid var(--success-color); }
        .removed { border-left: 4px solid var(--danger-color); }
        .modified { border-left: 4px solid var(--warning-color); }
        
        @media (max-width: 768px) {
            body { padding: 10px; }
            .header { padding: 30px 20px; }
            .header h1 { font-size: 2rem; }
            .change-header { flex-direction: column; align-items: flex-start; }
            .stats { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔄 OpenAPI Comparison Report</h1>
        <p>Generated on ${timestamp}</p>
        <a href="https://stefandango.dev" class="brand-link">🚀 Powered by stefandango.dev</a>
    </div>
    
    <div class="stats">
        <div class="stat">
            <div class="stat-number">${stats.total}</div>
            <div class="stat-label">Total Changes</div>
        </div>
        <div class="stat">
            <div class="stat-number">${stats.breaking}</div>
            <div class="stat-label">Breaking Changes</div>
        </div>
        <div class="stat">
            <div class="stat-number">${stats.added}</div>
            <div class="stat-label">Added</div>
        </div>
        <div class="stat">
            <div class="stat-number">${stats.removed}</div>
            <div class="stat-label">Removed</div>
        </div>
        <div class="stat">
            <div class="stat-number">${stats.modified}</div>
            <div class="stat-label">Modified</div>
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

    // Compact Export Methods
    exportMarkdownCompact() {
        if (this.changes.length === 0) {
            alert('No changes to export. Please compare two API specifications first.');
            return;
        }

        const stats = this.calculateStatistics();
        const timestamp = new Date().toISOString().split('T')[0];
        
        let markdown = `# OpenAPI Diff - Compact Overview\n\n`;
        markdown += `**Date:** ${timestamp} | **Total Changes:** ${stats.total} | **Breaking:** ${stats.breaking}\n\n`;
        
        // Breaking changes first (if any)
        const breakingChanges = this.changes.filter(c => c.isBreaking);
        if (breakingChanges.length > 0) {
            markdown += `## ⚠️ Breaking Changes (${breakingChanges.length})\n\n`;
            breakingChanges.forEach(change => {
                markdown += `- **${change.type}** \`${change.path}\` _(${change.category})_\n`;
            });
            markdown += `\n`;
        }
        
        // Added items
        const addedChanges = this.changes.filter(c => c.category === 'added' && !c.isBreaking);
        if (addedChanges.length > 0) {
            markdown += `## ➕ Added (${addedChanges.length})\n\n`;
            addedChanges.forEach(change => {
                markdown += `- **${change.type}** \`${change.path}\`\n`;
            });
            markdown += `\n`;
        }
        
        // Removed items
        const removedChanges = this.changes.filter(c => c.category === 'removed' && !c.isBreaking);
        if (removedChanges.length > 0) {
            markdown += `## ➖ Removed (${removedChanges.length})\n\n`;
            removedChanges.forEach(change => {
                markdown += `- **${change.type}** \`${change.path}\`\n`;
            });
            markdown += `\n`;
        }
        
        // Modified items
        const modifiedChanges = this.changes.filter(c => c.category === 'modified' && !c.isBreaking);
        if (modifiedChanges.length > 0) {
            markdown += `## 🔄 Modified (${modifiedChanges.length})\n\n`;
            modifiedChanges.forEach(change => {
                markdown += `- **${change.type}** \`${change.path}\`\n`;
            });
            markdown += `\n`;
        }

        this.downloadFile(markdown, 'api-diff-compact.md', 'text/markdown');
    }

    exportJSONCompact() {
        if (this.changes.length === 0) {
            alert('No changes to export. Please compare two API specifications first.');
            return;
        }

        const stats = this.calculateStatistics();
        const compactData = {
            timestamp: new Date().toISOString(),
            summary: stats,
            changes: {
                breaking: this.changes.filter(c => c.isBreaking).map(c => ({
                    type: c.type,
                    path: c.path,
                    category: c.category
                })),
                added: this.changes.filter(c => c.category === 'added' && !c.isBreaking).map(c => ({
                    type: c.type,
                    path: c.path
                })),
                removed: this.changes.filter(c => c.category === 'removed' && !c.isBreaking).map(c => ({
                    type: c.type,
                    path: c.path
                })),
                modified: this.changes.filter(c => c.category === 'modified' && !c.isBreaking).map(c => ({
                    type: c.type,
                    path: c.path
                }))
            },
            overview: {
                totalChanges: stats.total,
                hasBreakingChanges: stats.breaking > 0,
                mostCommonChangeType: this.getMostCommonChangeType(),
                affectedEndpoints: [...new Set(this.changes.map(c => c.path.split(' ')[0]))].length
            }
        };

        this.downloadFile(JSON.stringify(compactData, null, 2), 'api-diff-compact.json', 'application/json');
    }

    getMostCommonChangeType() {
        const typeCounts = {};
        this.changes.forEach(change => {
            typeCounts[change.type] = (typeCounts[change.type] || 0) + 1;
        });
        return Object.entries(typeCounts).reduce((a, b) => typeCounts[a[0]] > typeCounts[b[0]] ? a : b)[0] || 'None';
    }

    exportHTMLCompact() {
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
    <title>OpenAPI Diff - Compact Overview</title>
    <style>
        body { 
            font-family: 'Inter', -apple-system, sans-serif; 
            margin: 20px; 
            background: #0a0e1a; 
            color: #f0f4f8; 
            line-height: 1.4; 
            font-size: 14px;
        }
        .header { 
            text-align: center; 
            margin-bottom: 25px; 
            padding: 20px;
            background: linear-gradient(135deg, #0078d4, #1e40af);
            border-radius: 10px;
        }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); 
            gap: 12px; 
            margin-bottom: 25px; 
        }
        .stat { 
            text-align: center; 
            padding: 12px; 
            background: rgba(20, 25, 35, 0.9); 
            border-radius: 6px;
            border: 1px solid rgba(0, 120, 212, 0.2);
        }
        .stat-number { 
            font-size: 1.3rem; 
            font-weight: bold; 
            color: #0078d4; 
        }
        .section { 
            margin-bottom: 20px; 
            background: rgba(20, 25, 35, 0.6); 
            border-radius: 8px; 
            padding: 15px; 
        }
        .section h3 { 
            margin: 0 0 10px 0; 
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .breaking-section { border-left: 4px solid #e53e3e; }
        .added-section { border-left: 4px solid #38a169; }
        .removed-section { border-left: 4px solid #e53e3e; }
        .modified-section { border-left: 4px solid #f59e0b; }
        .change-item { 
            padding: 6px 0; 
            border-bottom: 1px solid rgba(255,255,255,0.05); 
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .change-item:last-child { border-bottom: none; }
        .change-type { 
            font-weight: 500; 
            font-size: 0.9rem;
        }
        .change-path { 
            font-family: 'SF Mono', monospace; 
            color: #d1d8e0; 
            font-size: 0.8rem; 
            opacity: 0.8;
        }
        .brand { 
            font-size: 0.8rem; 
            opacity: 0.7; 
            margin-top: 10px; 
        }
        .brand a { 
            color: #0078d4; 
            text-decoration: none; 
        }
        .no-changes {
            text-align: center;
            padding: 20px;
            opacity: 0.6;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔄 API Diff - Compact Overview</h1>
        <p>Generated on ${timestamp}</p>
        <div class="brand"><a href="https://stefandango.dev">🚀 stefandango.dev</a></div>
    </div>
    
    <div class="stats">
        <div class="stat">
            <div class="stat-number">${stats.total}</div>
            <div>Total</div>
        </div>
        <div class="stat">
            <div class="stat-number">${stats.breaking}</div>
            <div>Breaking</div>
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

        // Breaking changes section
        const breakingChanges = this.changes.filter(c => c.isBreaking);
        if (breakingChanges.length > 0) {
            html += `<div class="section breaking-section">
                <h3>⚠️ Breaking Changes (${breakingChanges.length})</h3>`;
            breakingChanges.forEach(change => {
                html += `<div class="change-item">
                    <span class="change-type">${change.type}</span>
                    <span class="change-path">${change.path}</span>
                </div>`;
            });
            html += `</div>`;
        }

        // Added section
        const addedChanges = this.changes.filter(c => c.category === 'added' && !c.isBreaking);
        if (addedChanges.length > 0) {
            html += `<div class="section added-section">
                <h3>➕ Added (${addedChanges.length})</h3>`;
            addedChanges.forEach(change => {
                html += `<div class="change-item">
                    <span class="change-type">${change.type}</span>
                    <span class="change-path">${change.path}</span>
                </div>`;
            });
            html += `</div>`;
        }

        // Removed section
        const removedChanges = this.changes.filter(c => c.category === 'removed' && !c.isBreaking);
        if (removedChanges.length > 0) {
            html += `<div class="section removed-section">
                <h3>➖ Removed (${removedChanges.length})</h3>`;
            removedChanges.forEach(change => {
                html += `<div class="change-item">
                    <span class="change-type">${change.type}</span>
                    <span class="change-path">${change.path}</span>
                </div>`;
            });
            html += `</div>`;
        }

        // Modified section
        const modifiedChanges = this.changes.filter(c => c.category === 'modified' && !c.isBreaking);
        if (modifiedChanges.length > 0) {
            html += `<div class="section modified-section">
                <h3>🔄 Modified (${modifiedChanges.length})</h3>`;
            modifiedChanges.forEach(change => {
                html += `<div class="change-item">
                    <span class="change-type">${change.type}</span>
                    <span class="change-path">${change.path}</span>
                </div>`;
            });
            html += `</div>`;
        }

        if (this.changes.length === 0) {
            html += `<div class="no-changes">No changes detected between the API specifications.</div>`;
        }

        html += `</body></html>`;

        this.downloadFile(html, 'api-diff-compact.html', 'text/html');
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
                    <div class="change-type">${this.escapeHtml(change.type)}</div>
                    <div class="change-path">${this.escapeHtml(change.path)}</div>
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
                    html += `<div><strong>${this.escapeHtml(key)}:</strong> ${this.escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value)}</div>`;
                }
            });
            html += `</div>`;
        }
        
        html += `</div>`;
        return html;
    }

    showFileLoading(fileNumber, text = 'Processing file...') {
        const loadingElement = document.getElementById(`loading${fileNumber}`);
        const urlLoadingElement = document.getElementById(`urlLoading${fileNumber}`);
        
        if (loadingElement) {
            const textElement = loadingElement.querySelector('.loading-text');
            textElement.textContent = text;
            loadingElement.style.display = 'block';
        }
        
        if (urlLoadingElement) {
            const textElement = urlLoadingElement.querySelector('.loading-text');
            textElement.textContent = text;
            urlLoadingElement.style.display = 'block';
        }
    }
    
    hideFileLoading(fileNumber) {
        const loadingElement = document.getElementById(`loading${fileNumber}`);
        const urlLoadingElement = document.getElementById(`urlLoading${fileNumber}`);
        
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        if (urlLoadingElement) {
            urlLoadingElement.style.display = 'none';
        }
    }
    
    updateFileLoadingText(fileNumber, text) {
        const loadingElement = document.getElementById(`loading${fileNumber}`);
        const urlLoadingElement = document.getElementById(`urlLoading${fileNumber}`);
        
        if (loadingElement) {
            const textElement = loadingElement.querySelector('.loading-text');
            if (textElement) {
                textElement.textContent = text;
            }
        }
        
        if (urlLoadingElement) {
            const textElement = urlLoadingElement.querySelector('.loading-text');
            if (textElement) {
                textElement.textContent = text;
            }
        }
    }
    
    showComparisonProgress() {
        const progressElement = document.getElementById('comparisonProgress');
        progressElement.style.display = 'block';
        
        // Reset all steps
        document.querySelectorAll('.progress-step').forEach(step => {
            step.classList.remove('active', 'completed');
        });
        
        // Reset progress bar
        document.getElementById('progressBar').style.width = '0%';
    }
    
    hideComparisonProgress() {
        const progressElement = document.getElementById('comparisonProgress');
        progressElement.style.display = 'none';
    }
    
    updateProgress(stepNumber, statusText) {
        const progressStatus = document.getElementById('progressStatus');
        const progressBar = document.getElementById('progressBar');
        const currentStep = document.getElementById(`step${stepNumber}`);
        
        // Update status text
        progressStatus.textContent = statusText;
        
        // Update progress bar (25% per step)
        const percentage = (stepNumber / 4) * 100;
        progressBar.style.width = percentage + '%';
        
        // Update step states
        document.querySelectorAll('.progress-step').forEach((step, index) => {
            const stepNum = index + 1;
            step.classList.remove('active', 'completed');
            
            if (stepNum < stepNumber) {
                step.classList.add('completed');
            } else if (stepNum === stepNumber) {
                step.classList.add('active');
            }
        });
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