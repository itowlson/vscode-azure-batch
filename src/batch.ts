export function parseJobTemplate(text : string) : IJobTemplate | null {
    
    try {

        const jobject : any = JSON.parse(text);
        if (!jobject) {
            return null;
        }

        if (!jobject.job) {
            return null;
        }

        return parseJobTemplateCore(jobject);

    } catch (SyntaxError) {
        return null;
    }
}

function parseJobTemplateCore(json : any) {
    
    const parameters : IJobTemplateParameter[] = [];

    for (const p in json.parameters || []) {
        const pval : any = json.parameters[p];
        parameters.push({
            name : p,
            dataType : <JobTemplateParameterDataType>(pval['type']),
            metadata : <IJobTemplateParameterMetadata>(pval['metadata']),
        })
    }

    return { parameters: parameters };

}

export interface IJobTemplate {
    readonly parameters : IJobTemplateParameter[];
}

export interface IJobTemplateParameter {
    readonly name : string;
    readonly dataType : JobTemplateParameterDataType;
    readonly defaultValue? : any;
    readonly metadata? : IJobTemplateParameterMetadata;
}

export interface IJobTemplateParameterMetadata {
    readonly description : string;
}

type JobTemplateParameterDataType = 'int' | 'string';
