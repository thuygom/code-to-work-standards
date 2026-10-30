import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from workflow_registry import load_workflows
from summarize_evaluation import summarize


class WorkflowRegistryTest(unittest.TestCase):
    def test_new_domain_and_invalid_registry(self):
        entry = {'slug': 'people', 'prefix': 'HR', 'name': '인사', 'outputs': {'HR1': '채용 검토'}, 'sop_stages': 1, 'prd_requirements': 1}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'registry.json'
            path.write_text(json.dumps([entry]), encoding='utf-8')
            self.assertEqual(load_workflows(path), [entry])
            with patch('summarize_evaluation.load_workflows', return_value=load_workflows(path)):
                case = {'case_id': 'CASE-HR-001', 'source_type': 'real', 'split': 'development', 'output_type': 'HR1'}
                self.assertEqual(summarize([case], []), {})
                with self.assertRaises(ValueError):
                    summarize([{**case, 'output_type': 'UNKNOWN1'}], [])
            for content in ([entry, entry], [{**entry, 'slug': '../private'}], [{**entry, 'sop_stages': True}], [{**entry, 'outputs': {'N1': 'wrong prefix'}}], {}):
                path.write_text(json.dumps(content), encoding='utf-8')
                with self.assertRaises(ValueError):
                    load_workflows(path)


if __name__ == '__main__':
    unittest.main()
