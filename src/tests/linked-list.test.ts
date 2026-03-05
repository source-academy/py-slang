import { TypeError } from "../errors";
import linkedList from "../stdlib/linked-list";
import { generateTestCases, TestCases } from "./utils";

describe('Linked List Tests', () => {
	const linkedListTests: TestCases = {
		'constructor and selector': [
			['head(pair(1, 2))', 1n, null],
            ['head(None)', TypeError, null],
            ['tail(None)', TypeError, null],
            
			['tail(pair(1, 2))', 2n, null],
			['linked_list()', null, null],
			['is_pair(pair(1, 2))', true, null],
			['is_pair(1)', false, null],
			['head(1)', TypeError, null],
			['tail(1)', TypeError, null],
			['print_linked_list(linked_list(1, 2, 3))', null, 'list(1, 2, 3)\n'],
			['print_linked_list(pair(1, 2))', null, '[1, 2]\n'],
			['print_linked_list(None)', null, 'list()\n'],
			['print_linked_list(pair(1, pair(2, 3)))', null, '[1, [2, 3]]\n']
		],
		'structural operations': [
			['equal(linked_list(1, 2), linked_list(1, 2))', true, null],
			['equal(linked_list(1, 2), linked_list(2, 1))', false, null],
			['equal(linked_list(1, linked_list(2, 3)), linked_list(1, linked_list(2, 3)))', true, null],
			['equal(linked_list(1, linked_list(2, 3)), linked_list(1, linked_list(3, 2)))', false, null],
			['length(linked_list(1, 2, 3, 4))', 4n, null],
			['length(None)', 0n, null],
			['linked_list_to_string(linked_list(1, 2))', '[1, [2, None]]', null],
			['linked_list_to_string(None)', 'None', null]
		],
		'transformations': [
			['equal(map_linked_list(lambda x: x + 1, linked_list(1, 2, 3)), linked_list(2, 3, 4))', true, null],
			['equal(map_linked_list(lambda x: x + 1, None), None)', true, null],
			['equal(build_linked_list(lambda i: i * i, 4), linked_list(0, 1, 4, 9))', true, null],
			['equal(build_linked_list(lambda i: i, 0), None)', true, null],
			['equal(reverse(linked_list(1, 2, 3)), linked_list(3, 2, 1))', true, null],
			['equal(reverse(None), None)', true, null],
			['equal(append(linked_list(1, 2), linked_list(3, 4)), linked_list(1, 2, 3, 4))', true, null],
			['equal(append(None, linked_list(3, 4)), linked_list(3, 4))', true, null],
			['equal(append(linked_list(1, 2), None), linked_list(1, 2))', true, null],
			['equal(filter_linked_list(lambda x: x % 2 == 0, linked_list(1, 2, 3, 4)), linked_list(2, 4))', true, null],
			['equal(filter_linked_list(lambda x: x > 10, linked_list(1, 2, 3, 4)), None)', true, null],
			['equal(enum_linked_list(3, 6), linked_list(3, 4, 5, 6))', true, null],
			['equal(enum_linked_list(6, 3), None)', true, null]
		],
		'search and removal': [
			['equal(member(1, linked_list(1, 2, 3, 4)), linked_list(1, 2, 3, 4))', true, null],
			['equal(member(3, linked_list(1, 2, 3, 4)), linked_list(3, 4))', true, null],
			['equal(member(9, linked_list(1, 2, 3, 4)), None)', true, null],
			['equal(remove(9, linked_list(1, 2, 3, 2)), linked_list(1, 2, 3, 2))', true, null],
			['equal(remove(2, linked_list(1, 2, 3, 2)), linked_list(1, 3, 2))', true, null],
			['equal(remove_all(9, linked_list(1, 2, 3, 2)), linked_list(1, 2, 3, 2))', true, null],
			['equal(remove_all(2, linked_list(1, 2, 3, 2)), linked_list(1, 3))', true, null]
		],
		'indexing and reducing': [
			['linked_list_ref(linked_list(10, 20, 30), 0)', 10n, null],
			['linked_list_ref(linked_list(10, 20, 30), 1)', 20n, null],
			['accumulate_linked_list(lambda x, y: x + y, 10, None)', 10n, null],
			['accumulate_linked_list(lambda x, y: x + y, 0, linked_list(1, 2, 3, 4))', 10n, null],
			['for_each(lambda x: x, None)', true, ""],
            ['for_each(print, linked_list(1, 2, 3))', true, "1\n2\n3\n"]
		]
	};

	generateTestCases(linkedListTests, 2, [linkedList]);
});
