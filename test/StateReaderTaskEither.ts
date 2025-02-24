import * as assert from 'assert'
import * as A from '../src/Array'
import * as E from '../src/Either'
import { pipe, SK, tuple } from '../src/function'
import * as I from '../src/IO'
import * as IE from '../src/IOEither'
import * as O from '../src/Option'
import * as R from '../src/Reader'
import * as RE from '../src/ReaderEither'
import * as RTE from '../src/ReaderTaskEither'
import * as RA from '../src/ReadonlyArray'
import { ReadonlyNonEmptyArray } from '../src/ReadonlyNonEmptyArray'
import { State } from '../src/State'
import * as _ from '../src/StateReaderTaskEither'
import * as S from '../src/string'
import * as T from '../src/Task'
import * as TE from '../src/TaskEither'
import * as U from './util'

const state: unknown = {}

describe('StateReaderTaskEither', () => {
  describe('pipeables', () => {
    it('alt', async () => {
      const e1 = await pipe(
        _.right('a'),
        _.alt(() => _.left(1)),
        _.evaluate(state)
      )({})()
      U.deepStrictEqual(e1, E.right('a'))
      const e2 = await pipe(
        pipe(
          _.left(1),
          _.alt(() => _.right('b')),
          _.evaluate(state)
        )
      )({})()
      U.deepStrictEqual(e2, E.right('b'))
      const e3 = await pipe(
        pipe(
          _.left(1),
          _.alt(() => _.left(2)),
          _.evaluate(state)
        )
      )({})()
      U.deepStrictEqual(e3, E.left(2))
    })

    it('map', async () => {
      const e = await pipe(_.right('aaa'), _.map(S.size), _.evaluate(state))({})()
      U.deepStrictEqual(e, E.right(3))
    })

    it('ap', async () => {
      const e = await pipe(_.right(S.size), _.ap(_.right('aaa')), _.evaluate(state))({})()
      U.deepStrictEqual(e, E.right(3))
    })

    it('apFirst', async () => {
      const e = await pipe(_.right('a'), _.apFirst(_.right('b')), _.evaluate(state))({})()
      U.deepStrictEqual(e, E.right('a'))
    })

    it('apFirstW', async () => {
      const fa = _.right<unknown, { readonly k: string }, 'Foo', string>('a')
      const fb = _.right<unknown, { readonly x: number }, 'Bar', number>(6)
      const e = await pipe(fa, _.apFirstW(fb), _.evaluate(state))({ k: 'v', x: 5 })()
      U.deepStrictEqual(e, E.right('a'))
    })

    it('apSecond', async () => {
      const e = await pipe(_.right('a'), _.apSecond(_.right('b')), _.evaluate(state))({})()
      U.deepStrictEqual(e, E.right('b'))
    })

    it('apSecondW', async () => {
      const fa = _.right<unknown, { readonly k: string }, 'Foo', string>('a')
      const fb = _.right<unknown, { readonly x: number }, 'Bar', number>(6)
      const e = await pipe(fa, _.apSecondW(fb), _.evaluate(state))({ k: 'v', x: 5 })()
      U.deepStrictEqual(e, E.right(6))
    })

    it('chain', async () => {
      const f = (s: string) => (s.length > 2 ? _.right(s.length) : _.right(0))
      const e = await pipe(_.right('aaa'), _.chain(f), _.evaluate(state))({})()
      U.deepStrictEqual(e, E.right(3))
    })

    it('chainFirst', async () => {
      const f = (s: string) => (s.length > 2 ? _.right(s.length) : _.right(0))
      const e = await pipe(_.right('aaa'), _.chainFirst(f), _.evaluate(state))({})()
      U.deepStrictEqual(e, E.right('aaa'))
    })

    it('flatten', async () => {
      const e = await pipe(_.right(_.right('a')), _.flatten, _.evaluate(state))({})()
      U.deepStrictEqual(e, E.right('a'))
    })

    type S = unknown
    type R1 = { readonly env1: unknown }
    type R2 = { readonly env2: unknown }
    type E1 = { readonly left1: unknown }
    type E2 = { readonly left2: unknown }

    it('flattenW', async () => {
      const e = await pipe(
        _.right<S, R1, E1, _.StateReaderTaskEither<S, R2, E2, 'a'>>(_.right('a')),
        _.flattenW,
        _.evaluate(state)
      )({ env1: '', env2: '' })()
      U.deepStrictEqual(e, E.right('a'))
    })

    it('bimap', async () => {
      const gt2 = (n: number): boolean => n > 2
      const e1 = await pipe(_.right('aaa'), _.bimap(gt2, S.size), _.evaluate(state))({})()
      U.deepStrictEqual(e1, E.right(3))
      const e2 = await pipe(_.left(3), _.bimap(gt2, S.size), _.evaluate(state))({})()
      U.deepStrictEqual(e2, E.left(true))
    })

    it('mapLeft', async () => {
      const gt2 = (n: number): boolean => n > 2
      const e = await pipe(_.left(3), _.mapLeft(gt2), _.evaluate(state))({})()
      U.deepStrictEqual(e, E.left(true))
    })

    it('fromPredicate', async () => {
      const predicate = (n: number) => n >= 2
      const gt2 = _.fromPredicate(predicate, (n) => `Invalid number ${n}`)

      const refinement = (u: string | number): u is number => typeof u === 'number'
      const isNumber = _.fromPredicate(refinement, (u) => `Invalid number ${String(u)}`)

      const e1 = await pipe(gt2(3), _.evaluate(state))({})()
      const e2 = await pipe(gt2(1), _.evaluate(state))({})()
      const e3 = await pipe(isNumber(4), _.evaluate(state))({})()
      U.deepStrictEqual(e1, E.right(3))
      U.deepStrictEqual(e2, E.left('Invalid number 1'))
      U.deepStrictEqual(e3, E.right(4))
    })

    it('filterOrElse', async () => {
      const e1 = await pipe(
        _.right(12),
        _.filterOrElse(
          (n) => n > 10,
          () => 'a'
        ),
        _.evaluate(state)
      )({})()
      U.deepStrictEqual(e1, E.right(12))

      const e2 = await pipe(
        _.right(8),
        _.filterOrElse(
          (n) => n > 10,
          () => 'a'
        ),
        _.evaluate(state)
      )({})()
      U.deepStrictEqual(e2, E.left('a'))
    })
  })

  // -------------------------------------------------------------------------------------
  // instances
  // -------------------------------------------------------------------------------------

  it('applicativeStateReaderTaskEither', async () => {
    await U.assertSeq(_.Applicative, _.FromTask, (fa) => fa(null)(null)())
  })

  // -------------------------------------------------------------------------------------
  // utils
  // -------------------------------------------------------------------------------------

  it('run', async () => {
    const ma = _.right('a')
    const e = await ma({})({})()
    assert.deepStrictEqual(e, E.right(['a', {}]))
  })

  it('applicativeReaderTaskEitherSeq', async () => {
    const log: Array<string> = []
    const append = (message: string): _.StateReaderTaskEither<{}, {}, void, number> =>
      _.rightTask(() => Promise.resolve(log.push(message)))
    const t1 = pipe(
      append('start 1'),
      _.chain(() => append('end 1'))
    )
    const t2 = pipe(
      append('start 2'),
      _.chain(() => append('end 2'))
    )
    const sequence = A.sequence(_.Applicative)
    U.deepStrictEqual(await sequence([t1, t2])({})({})(), E.right([[2, 4], {}]))
    U.deepStrictEqual(log, ['start 1', 'end 1', 'start 2', 'end 2'])
  })

  it('execute', async () => {
    const ma = _.right('a')
    const e = await pipe(ma, _.execute(state))({})()
    U.deepStrictEqual(e, E.right({}))
  })

  it('rightState', async () => {
    const s: State<unknown, number> = (s) => [1, s]
    const e = await pipe(_.rightState(s), _.evaluate(state))({})()
    U.deepStrictEqual(e, E.right(1))
  })

  it('leftState', async () => {
    const s: State<unknown, number> = (s) => [1, s]
    const e = await pipe(_.leftState(s), _.evaluate(state))({})()
    U.deepStrictEqual(e, E.left(1))
  })

  it('fromReaderTaskEither', async () => {
    const rte: RTE.ReaderTaskEither<{}, string, number> = RTE.right(1)
    const e = await pipe(_.fromReaderTaskEither(rte), _.evaluate(state))({})()
    U.deepStrictEqual(e, E.right(1))
  })

  it('left', async () => {
    const e = await _.left(1)({})({})()
    U.deepStrictEqual(e, E.left(1))
  })

  it('rightTask', async () => {
    const e = await _.rightTask(T.of(1))({})({})()
    assert.deepStrictEqual(e, E.right([1, {}]))
  })

  it('leftTask', async () => {
    const e = await _.leftTask(T.of(1))({})({})()
    U.deepStrictEqual(e, E.left(1))
  })

  it('fromTaskEither', async () => {
    const e = await _.fromTaskEither(TE.of(1))({})({})()
    assert.deepStrictEqual(e, E.right([1, {}]))
  })

  it('rightReader', async () => {
    const e = await _.rightReader(R.of(1))({})({})()
    assert.deepStrictEqual(e, E.right([1, {}]))
  })

  it('leftReader', async () => {
    const e = await _.leftReader(R.of(1))({})({})()
    U.deepStrictEqual(e, E.left(1))
  })

  it('fromIOEither', async () => {
    const e1 = await _.fromIOEither(IE.right(1))({})({})()
    assert.deepStrictEqual(e1, E.right([1, {}]))
    const e2 = await _.fromIOEither(IE.left(1))({})({})()
    U.deepStrictEqual(e2, E.left(1))
  })

  it('fromEither', async () => {
    const e1 = await _.fromEither(E.right(1))({})({})()
    assert.deepStrictEqual(e1, E.right([1, {}]))
    const e2 = await _.fromEither(E.left(1))({})({})()
    U.deepStrictEqual(e2, E.left(1))
  })

  it('fromOption', async () => {
    const e1 = await _.fromOption(() => 'err')(O.some(1))({})({})()
    assert.deepStrictEqual(e1, E.right([1, {}]))
    const e2 = await _.fromOption(() => 'err')(O.none)({})({})()
    U.deepStrictEqual(e2, E.left('err'))
  })

  it('rightIO', async () => {
    const e = await _.rightIO(I.of(1))({})({})()
    assert.deepStrictEqual(e, E.right([1, {}]))
  })

  it('leftIO', async () => {
    const e = await _.leftIO(I.of(1))({})({})()
    U.deepStrictEqual(e, E.left(1))
  })

  it('fromOption', async () => {
    const e1 = await _.fromOption(() => 'none')(O.none)({})({})()
    U.deepStrictEqual(e1, E.left('none'))
    const e2 = await _.fromOption(() => 'none')(O.some(1))({})({})()
    assert.deepStrictEqual(e2, E.right([1, {}]))
  })

  it('fromReaderEither', async () => {
    const e1 = await _.fromReaderEither(RE.left('a'))({})({})()
    U.deepStrictEqual(e1, E.left('a'))
    const e2 = await _.fromReaderEither(RE.right(1))({})({})()
    assert.deepStrictEqual(e2, E.right([1, {}]))
  })

  it('chainEitherK', async () => {
    const f = (s: string) => E.right(s.length)
    const x = await pipe(_.right('a'), _.chainEitherK(f))(undefined)(undefined)()
    assert.deepStrictEqual(x, E.right([1, undefined]))
  })

  it('chainIOEitherK', async () => {
    const f = (s: string) => IE.right(s.length)
    const x = await pipe(_.right('a'), _.chainIOEitherK(f))(undefined)(undefined)()
    assert.deepStrictEqual(x, E.right([1, undefined]))
  })

  it('chainTaskEitherK', async () => {
    const f = (s: string) => TE.right(s.length)
    const x = await pipe(_.right('a'), _.chainTaskEitherK(f))(undefined)(undefined)()
    assert.deepStrictEqual(x, E.right([1, undefined]))
  })

  it('chainReaderTaskEitherK', async () => {
    const f = (s: string) => RTE.right(s.length)
    const x = await pipe(_.right('a'), _.chainReaderTaskEitherK(f))(undefined)(undefined)()
    assert.deepStrictEqual(x, E.right([1, undefined]))
  })

  it('put', async () => {
    assert.deepStrictEqual(await _.put(2)(1)({})(), E.right([undefined, 2]))
  })

  it('get', async () => {
    assert.deepStrictEqual(await _.get()(1)({})(), E.right([1, 1]))
  })

  it('modify', async () => {
    assert.deepStrictEqual(await _.modify(U.double)(1)({})(), E.right([undefined, 2]))
  })

  it('gets', async () => {
    U.deepStrictEqual(await _.gets(U.double)(1)({})(), E.right([2, 1]))
  })

  it('do notation', async () => {
    assert.deepStrictEqual(
      await pipe(
        _.right<void, void, string, number>(1),
        _.bindTo('a'),
        _.bind('b', () => _.right('b'))
      )(undefined)(undefined)(),
      E.right([{ a: 1, b: 'b' }, undefined])
    )
  })

  it('apS', async () => {
    assert.deepStrictEqual(
      await pipe(_.right<void, void, string, number>(1), _.bindTo('a'), _.apS('b', _.right('b')))(undefined)(
        undefined
      )(),
      E.right([{ a: 1, b: 'b' }, undefined])
    )
  })

  describe('array utils', () => {
    const input: ReadonlyNonEmptyArray<string> = ['a', 'b']

    it('traverseReadonlyArrayWithIndex', async () => {
      const f = _.traverseReadonlyArrayWithIndex((i, a: string) => (a.length > 0 ? _.right(a + i) : _.left('e')))
      U.deepStrictEqual(await pipe(RA.empty, f)(undefined)(undefined)(), E.right(tuple(RA.empty, undefined)))
      U.deepStrictEqual(await pipe(input, f)(undefined)(undefined)(), E.right(tuple(['a0', 'b1'], undefined)))
      U.deepStrictEqual(await pipe(['a', ''], f)(undefined)(undefined)(), E.left('e'))
      const append = (_i: number, n: number): _.StateReaderTaskEither<ReadonlyArray<number>, {}, Error, void> =>
        _.modify((a) => [...a, n])
      U.deepStrictEqual(
        await pipe(
          [1, 2, 3],
          _.traverseReadonlyArrayWithIndex(append),
          _.map(() => undefined)
        )([])({})(),
        E.right(tuple(undefined, [1, 2, 3]))
      )
    })

    it('sequenceReadonlyArray', async () => {
      const log: Array<number | string> = []
      const right = (n: number): _.StateReaderTaskEither<undefined, undefined, string, number> =>
        _.rightIO(() => {
          log.push(n)
          return n
        })
      const left = (s: string): _.StateReaderTaskEither<undefined, undefined, string, number> =>
        _.leftIO(() => {
          log.push(s)
          return s
        })
      U.deepStrictEqual(
        await pipe([right(1), right(2)], _.traverseReadonlyArrayWithIndex(SK))(undefined)(undefined)(),
        E.right(tuple([1, 2], undefined))
      )
      U.deepStrictEqual(
        await pipe([right(3), left('a')], _.traverseReadonlyArrayWithIndex(SK))(undefined)(undefined)(),
        E.left('a')
      )
      U.deepStrictEqual(
        await pipe([left('b'), right(4)], _.traverseReadonlyArrayWithIndex(SK))(undefined)(undefined)(),
        E.left('b')
      )
      U.deepStrictEqual(log, [1, 2, 3, 'a', 'b'])
    })

    // old
    it('sequenceArray', async () => {
      const log: Array<number | string> = []
      const right = (n: number): _.StateReaderTaskEither<undefined, undefined, string, number> =>
        _.rightIO(() => {
          log.push(n)
          return n
        })
      const left = (s: string): _.StateReaderTaskEither<undefined, undefined, string, number> =>
        _.leftIO(() => {
          log.push(s)
          return s
        })
      assert.deepStrictEqual(
        await pipe([right(1), right(2)], _.sequenceArray)(undefined)(undefined)(),
        E.right([[1, 2], undefined])
      )
      U.deepStrictEqual(await pipe([right(3), left('a')], _.sequenceArray)(undefined)(undefined)(), E.left('a'))
      U.deepStrictEqual(await pipe([left('b'), right(4)], _.sequenceArray)(undefined)(undefined)(), E.left('b'))
      U.deepStrictEqual(log, [1, 2, 3, 'a', 'b'])
    })

    it('#1486', async () => {
      const append = (n: number): _.StateReaderTaskEither<ReadonlyArray<number>, {}, Error, void> =>
        _.modify((a) => [...a, n])
      U.deepStrictEqual(
        await pipe(
          [1, 2, 3],
          _.traverseArray(append),
          _.map(() => undefined)
        )([])({})(),
        E.right(tuple(undefined, [1, 2, 3]))
      )
    })
  })

  it('fromState', async () => {
    const s: State<unknown, number> = (s) => [1, s]
    const e = await pipe(_.fromState(s), _.evaluate(state))({})()
    U.deepStrictEqual(e, E.right(1))
  })

  it('fromStateK', async () => {
    const ma = _.fromStateK((n: number): State<number, number> => (s) => [n * 2, s + 1])
    U.deepStrictEqual(await ma(3)(2)({})(), E.right([6, 3]))
  })

  it('chainStateK', async () => {
    const f = _.chainStateK((n: number): State<number, number> => (s) => [n * 2, s + 1])
    const right: _.StateReaderTaskEither<number, unknown, never, number> = _.right(3)
    U.deepStrictEqual(await pipe(right, f)(2)({})(), E.right([6, 3]))
    const left: _.StateReaderTaskEither<number, unknown, string, number> = _.left('a')
    U.deepStrictEqual(await pipe(left, f)(2)({})(), E.left('a'))
  })

  it('local', async () => {
    U.deepStrictEqual(
      await pipe(
        _.asks((n: number) => n + 1),
        _.local(S.size)
      )({})('aaa')(),
      E.right(tuple(4, {}))
    )
  })

  it('asksStateReaderTaskEither', async () => {
    interface Env {
      readonly count: number
    }
    const e: Env = { count: 0 }
    const f = (e: Env) => _.of(e.count + 1)
    U.deepStrictEqual(await _.asksStateReaderTaskEither(f)({})(e)(), E.right(tuple(1, {})))
  })

  it('chainFirstEitherK', async () => {
    const f = (s: string) => E.right(s.length)
    U.deepStrictEqual(await pipe(_.right('a'), _.chainFirstEitherK(f), _.evaluate(state))({})(), E.right('a'))
    const g = (s: string) => E.left(s.length)
    U.deepStrictEqual(await pipe(_.right('a'), _.chainFirstEitherK(g), _.evaluate(state))({})(), E.left(1))
  })
})
