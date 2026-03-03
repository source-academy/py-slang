import linkedList from "../stdlib/linked-list";
import { generateTestCases, TestCases } from "./utils";

describe('Linked List Tests', () => {
	const linkedListTests: TestCases = {
		'constructor and selector': [
			['head(pair(1, 2))', 1n],
			['tail(pair(1, 2))', 2n],
			['linked_list()', null],
			['is_pair(pair(1, 2))', true],
			['is_pair(1)', false],
			['head(1)', TypeError],
			['tail(1)', TypeError],
			['print_linked_list(linked_list(1, 2, 3))', 'list(1, 2, 3)'],
			['print_linked_list(pair(1, 2))', '[1, 2]'],
			['print_linked_list(None)', 'None'],
			['print_linked_list(pair(1, pair(2, 3)))', '[1, [2, 3]]']
		],
		'structural operations': [
			['equal(linked_list(1, 2), linked_list(1, 2))', true],
			['equal(linked_list(1, 2), linked_list(2, 1))', false],
			['equal(linked_list(1, linked_list(2, 3)), linked_list(1, linked_list(2, 3)))', true],
			['equal(linked_list(1, linked_list(2, 3)), linked_list(1, linked_list(3, 2)))', false],
			['length(linked_list(1, 2, 3, 4))', 4n],
			['length(None)', 0n],
			['list_to_string(linked_list(1, 2))', '[1, [2, null]]'],
			['list_to_string(None)', 'null']
		],
		'transformations': [
			['equal(map(lambda x: x + 1, linked_list(1, 2, 3)), linked_list(2, 3, 4))', true],
			['equal(map(lambda x: x + 1, None), None)', true],
			['equal(build_list(lambda i: i * i, 4), linked_list(0, 1, 4, 9))', true],
			['equal(build_list(lambda i: i, 0), None)', true],
			['equal(reverse(linked_list(1, 2, 3)), linked_list(3, 2, 1))', true],
			['equal(reverse(None), None)', true],
			['equal(append(linked_list(1, 2), linked_list(3, 4)), linked_list(1, 2, 3, 4))', true],
			['equal(append(None, linked_list(3, 4)), linked_list(3, 4))', true],
			['equal(append(linked_list(1, 2), None), linked_list(1, 2))', true],
			['equal(filter(lambda x: x % 2 == 0, linked_list(1, 2, 3, 4)), linked_list(2, 4))', true],
			['equal(filter(lambda x: x > 10, linked_list(1, 2, 3, 4)), None)', true],
			['equal(enum_list(3, 6), linked_list(3, 4, 5, 6))', true],
			['equal(enum_list(6, 3), None)', true]
		],
		'search and removal': [
			['equal(member(1, linked_list(1, 2, 3, 4)), linked_list(1, 2, 3, 4))', true],
			['equal(member(3, linked_list(1, 2, 3, 4)), linked_list(3, 4))', true],
			['equal(member(9, linked_list(1, 2, 3, 4)), None)', true],
			['equal(remove(9, linked_list(1, 2, 3, 2)), linked_list(1, 2, 3, 2))', true],
			['equal(remove(2, linked_list(1, 2, 3, 2)), linked_list(1, 3, 2))', true],
			['equal(remove_all(9, linked_list(1, 2, 3, 2)), linked_list(1, 2, 3, 2))', true],
			['equal(remove_all(2, linked_list(1, 2, 3, 2)), linked_list(1, 3))', true]
		],
		'indexing and reducing': [
			['list_ref(linked_list(10, 20, 30), 0)', 10n],
			['list_ref(linked_list(10, 20, 30), 1)', 20n],
			['accumulate(lambda x, y: x + y, 10, None)', 10n],
			['accumulate(lambda x, y: x + y, 0, linked_list(1, 2, 3, 4))', 10n],
			['for_each(lambda x: x, None)', true]
		]
	};

	generateTestCases(linkedListTests, 2, [linkedList]);
});
