"""Checks for source-backed concept diagrams; uses only the standard library."""
import copy
import unittest
from unittest.mock import patch

import build_content as content


class AnswerMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.courses = [content.extract_course(path) for path in content.COURSES.glob("*.docx")]
        cls.path = content.COURSES / "5-kamu-giderleri-1-pacer.docx"
        cls.course = content.extract_course(cls.path)

    def test_all_answered_map_tasks_have_source_backed_diagrams(self):
        self.assertEqual(len(self.courses), 31)
        self.assertEqual(sum(len(course["blocks"]) for course in self.courses), 129)
        self.assertEqual(sum(len(course["answerMaps"]) for course in self.courses), 93)
        for course in self.courses:
            expected = {task["id"] for task in course["mapWalks"] if task["answer"]}
            self.assertEqual({diagram["id"] for diagram in course["answerMaps"]}, expected)

    def test_left_arrow_in_original_answer_keeps_its_direction(self):
        task = next(task for task in self.course["mapWalks"] if task["id"] == "Y1")
        self.assertIn("Maliye politikası ← (esnekliğini azaltır) Bütçe katılığı", task["answer"])
        diagram = next(diagram for diagram in self.course["answerMaps"] if diagram["id"] == "Y1")
        self.assertIn(["Bütçe katılığı", "esnekliğini azaltır", "Maliye politikası"], diagram["links"])

    def test_changed_answer_requires_review_instead_of_stale_diagram(self):
        tasks = copy.deepcopy(self.course["mapWalks"])
        tasks[0]["answer"] += " Yeni açıklama."
        with self.assertRaisesRegex(ValueError, "new or changed"):
            content.build_answer_maps(self.path, tasks)

    def test_cyclic_diagram_is_rejected(self):
        definition = copy.deepcopy(content.MAP_DEFINITIONS["5"])
        definition["Y1"].append(["Maliye politikası", "hatalı döngü", "Bütçe hakkı"])
        with patch.dict(content.MAP_DEFINITIONS, {"5": definition}):
            with self.assertRaisesRegex(ValueError, "Cyclic"):
                content.build_answer_maps(self.path, self.course["mapWalks"])

    def test_disconnected_diagram_is_rejected(self):
        definition = copy.deepcopy(content.MAP_DEFINITIONS["5"])
        definition["Y1"].append(["İlgisiz kavram", "hatalı bağlantı", "Başka kavram"])
        with patch.dict(content.MAP_DEFINITIONS, {"5": definition}):
            with self.assertRaisesRegex(ValueError, "Disconnected"):
                content.build_answer_maps(self.path, self.course["mapWalks"])


if __name__ == "__main__":
    unittest.main()
