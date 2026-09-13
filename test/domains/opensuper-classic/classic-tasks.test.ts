import { describe, expect, it } from 'vitest';
import {
  assignClassicTaskIds,
  classicTaskRequirements,
  classicTaskRevision,
  completeClassicTask,
  parseClassicTasks,
  validateClassicTaskPlan,
  inspectClassicPlanTasks,
  synchronizeClassicPlanTasks,
} from '../../../domains/opensuper-classic/classic-tasks.js';

describe('Classic canonical tasks', () => {
  it('synchronizes mapped legacy checkboxes by ID, never by order or task wording', () => {
    const tasks = parseClassicTasks(
      '- [x] renamed <!-- opensuper-task:a -->\n- [ ] second <!-- opensuper-task:b -->',
    );
    const plan =
      '- [x] second <!-- opensuper-task:b -->\n- [ ] old name <!-- opensuper-task:a -->\n';
    expect(inspectClassicPlanTasks(plan, tasks).unmapped).toEqual([]);
    const updated = synchronizeClassicPlanTasks(plan, tasks);
    expect(parseClassicTasks(updated).map((task) => [task.id, task.completed])).toEqual([
      ['b', false],
      ['a', true],
    ]);
    expect(synchronizeClassicPlanTasks(updated, tasks)).toBe(updated);
  });
  it('preserves and reports unmapped or extra legacy plan tasks instead of guessing completion', () => {
    const tasks = parseClassicTasks('- [x] done <!-- opensuper-task:a -->');
    const plan = '- [ ] done\n- [ ] extra <!-- opensuper-task:other -->';
    expect(inspectClassicPlanTasks(plan, tasks).unmapped).toHaveLength(2);
    expect(() => synchronizeClassicPlanTasks(plan, tasks)).toThrow('mapping');
    expect(synchronizeClassicPlanTasks('Plan references only', tasks)).toBe('Plan references only');
  });
  it('uses canonical plan references without a second progress ledger and preserves legacy plans', () => {
    const tasks = parseClassicTasks('- [ ] one <!-- opensuper-task:a -->');
    const plan =
      '<!-- opensuper-task-authority: openspec/changes/demo/tasks.md -->\n## Implementation\n<!-- opensuper-task-ref:a -->\nImplementation details';
    const validate = (text: string) =>
      validateClassicTaskPlan(text, 'openspec/changes/demo/tasks.md', tasks);
    expect(validate(plan)).toBe('canonical');
    expect(validate('- [ ] legacy')).toBe('legacy');
    expect(() => validate(plan + '\n- [x] duplicate ledger')).toThrow('second checkbox');
    expect(() => validate(plan.replace('ref:a', 'ref:b'))).toThrow('missing task');
    expect(() => validate(plan.replace('<!-- opensuper-task-ref:a -->', ''))).toThrow('each task');
    expect(() => validate(plan.replace('/demo/', '/other/'))).toThrow('this change');
  });
  it('ignores fenced examples and recognizes nested tasks and either bullet', () => {
    expect(parseClassicTasks('```md\n- [x] example\n```\n- [ ] parent\n  * [X] child\n')).toEqual([
      { id: null, text: 'parent', completed: false, line: 4 },
      { id: null, text: 'child', completed: true, line: 5 },
    ]);
  });
  it.each(['\n', '\r\n'])('preserves line endings %j and assigns persistent unique IDs', (eol) => {
    const source = `- [ ] same${eol}- [x] same${eol}`;
    const assigned = assignClassicTaskIds(source);
    const tasks = parseClassicTasks(assigned);
    expect(tasks[0].id).toBeTruthy();
    expect(tasks[1].id).not.toBe(tasks[0].id);
    expect(assignClassicTaskIds(assigned)).toBe(assigned);
    expect(assigned.split(eol)).toHaveLength(3);
  });
  it('completes the correct ID after reorder and refuses a stale renamed task', () => {
    const source = '- [ ] one <!-- opensuper-task:a -->\n- [ ] two <!-- opensuper-task:b -->\n';
    const reordered = source.split('\n').slice(0, 2).reverse().join('\n') + '\n';
    const result = completeClassicTask(reordered, 'a', classicTaskRevision(reordered));
    expect(parseClassicTasks(result).map((task) => [task.id, task.completed])).toEqual([
      ['b', false],
      ['a', true],
    ]);
    expect(() =>
      completeClassicTask(source.replace('one', 'changed'), 'a', classicTaskRevision(source)),
    ).toThrow('requirements changed');
  });
  it('permits independent completion and idempotent retries without changing requirements', () => {
    const source = assignClassicTaskIds('- [ ] one\n- [ ] two\n');
    const revision = classicTaskRevision(source);
    const [one, two] = parseClassicTasks(source);
    const first = completeClassicTask(source, one.id!, revision);
    const second = completeClassicTask(first, two.id!, revision);
    expect(parseClassicTasks(second).every((task) => task.completed)).toBe(true);
    expect(completeClassicTask(second, one.id!, revision)).toBe(second);
    expect(classicTaskRequirements(second)).toBe(source);
  });
  it('rejects duplicate IDs, malformed IDs and ambiguous legacy completion', () => {
    expect(() =>
      parseClassicTasks('- [ ] one <!-- opensuper-task:a -->\n- [ ] two <!-- opensuper-task:a -->'),
    ).toThrow('Duplicate');
    expect(() => parseClassicTasks('- [ ] one <!-- opensuper-task: -->')).toThrow('Malformed');
    const legacy = '- [ ] one\n';
    expect(() => completeClassicTask(legacy, 'one', classicTaskRevision(legacy))).toThrow('Legacy');
  });
});
