//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as batch from '../src/batch';

const nonJson = " \
  id : 'wonderjob' \
  poolInfo \
      poolId : 'wonderpool' \
";

const jobJson = ' \
{ \
  "id" : "wonderjob", \
  "poolInfo" : { \
      "poolId" : "wonderpool" \
  } \
} \
';

const jobTemplateJson = ' \
{ \
  "parameters": { \
    "jobId": { \
      "type": "string", \
      "metadata": { \
        "description": "The id of the Batch job" \
      } \
    }, \
    "poolId": { \
      "type": "string", \
      "metadata": { \
        "description": "The id of the Batch pool on which to run the job" \
      } \
    } \
  }, \
  "job": { \
    "id" : "wonderjob", \
    "poolInfo" : { \
        "poolId" : "wonderpool" \
    } \
  } \
} \
';

const jobTemplateJsonNoParams = ' \
{ \
  "job": { \
    "id" : "wonderjob", \
    "poolInfo" : { \
        "poolId" : "wonderpool" \
    } \
  } \
} \
';

suite('Batch Utilities Tests', () => {

    test('Parsing a non-JSON document as a job template fails', () => {
        const result = batch.parseJobTemplate(nonJson);
        assert.equal(result, null);
    });

    test('Parsing a job JSON as a job template fails', () => {
        const result = batch.parseJobTemplate(jobJson);
        assert.equal(result, null);
    });

    test('Parsing job template JSON as a job template succeeds', () => {
        const template = batch.parseJobTemplate(jobTemplateJson);
        assert.notEqual(template, null);
    });

    test('Parsing job template JSON surfaces the parameters', () => {
        const template = <batch.IJobTemplate>batch.parseJobTemplate(jobTemplateJson);
        assert.equal(template.parameters.length, 2);
        
        const jobIdParameter = template.parameters[0];
        assert.equal('jobId', jobIdParameter.name);
        assert.equal('string', jobIdParameter.dataType);
        assert.notEqual(undefined, jobIdParameter.metadata);
        if (jobIdParameter.metadata) {
            assert.equal('The id of the Batch job', jobIdParameter.metadata.description);
        }
    });

    test('A job template can be parsed even if it has no parameters', () => {
        const template = <batch.IJobTemplate>batch.parseJobTemplate(jobTemplateJsonNoParams);
        assert.equal(template.parameters.length, 0);
    });
});