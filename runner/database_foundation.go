package main

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
)

const databaseFoundationVerifierVersion = "database-foundation-v1"

var errInvalidDatabaseFoundation = errors.New("数据库基础练习未通过验收")

func runDatabaseFoundation(unitID, code string) (mysqlLessonResult, error) {
	statements, normalized, err := tokenizeMySQL(code)
	if err != nil || len(statements) != 1 {
		return mysqlLessonResult{}, databaseFoundationFailure("请提交一条完整的 SQL 语句")
	}
	stmt := statements[0]
	var output string
	switch unitID {
	case "db-01":
		if !startsMySQLWith(stmt, "select") || !hasMySQLSequence(stmt, "from", "orders") || hasMySQLToken(stmt, "*") || !hasMySQLWords(stmt, "id", "drink", "amount_cents") {
			return mysqlLessonResult{}, databaseFoundationFailure("把 * 换成 id、drink、amount_cents 三个列名")
		}
		output = "id   | drink    | amount_cents\no101 | 茉莉奶绿 | 1600\no102 | 黑糖珍珠 | 1800"
	case "db-02":
		if !startsMySQLWith(stmt, "select") || !hasMySQLSequence(stmt, "from", "orders") || !hasMySQLWord(stmt, "where") || !whereHasMySQLWords(stmt, "id") || !statementContainsString(stmt, "o101") {
			return mysqlLessonResult{}, databaseFoundationFailure("用 WHERE id = 'o101' 按主键查找订单")
		}
		output = "id   | drink\no101 | 茉莉奶绿\n\n主键命中 1 行；列表排序变化不会改变订单身份。"
	case "db-03":
		if !startsMySQLWith(stmt, "select") || !hasMySQLSequence(stmt, "from", "orders") || !hasMySQLSequence(stmt, "note", "is", "null") {
			return mysqlLessonResult{}, databaseFoundationFailure("NULL 不能用 = 比较，请写 note IS NULL")
		}
		output = "id   | note\no101 | NULL\n\nIS NULL 找到了尚未填写备注的订单。"
	case "db-04":
		if !startsMySQLWith(stmt, "select") || !hasMySQLWord(stmt, "join") || !hasMySQLWords(stmt, "orders", "customers", "customer_id") || !onHasMySQLWords(stmt, "customer_id", "id") {
			return mysqlLessonResult{}, databaseFoundationFailure("JOIN 的 ON 条件应把 orders.customer_id 对应到 customers.id")
		}
		output = "order_id | customer_name\no101     | 阿宁\no102     | 小林\n\n关系成立：订单只保存 customer_id，姓名仍由 customers 表维护。"
	case "db-05":
		if !startsMySQLWith(stmt, "select") || !hasMySQLSequence(stmt, "from", "orders") || !whereHasMySQLWords(stmt, "status") || !statementContainsString(stmt, "paid") || !hasMySQLSequence(stmt, "order", "by") || !hasMySQLWord(stmt, "desc") || !hasMySQLSequence(stmt, "limit", "1") {
			return mysqlLessonResult{}, databaseFoundationFailure("保留已付款筛选与时间倒序，把 LIMIT 改为 1")
		}
		output = "id   | drink    | amount_cents\no102 | 黑糖珍珠 | 1800\n\n只返回 created_at 最新的 1 笔已付款订单。"
	case "db-06":
		if !startsMySQLWith(stmt, "create", "table") || !hasMySQLWord(stmt, "orders") || !hasMySQLSequence(stmt, "primary", "key") || !hasMySQLWords(stmt, "id", "customer_id", "amount_cents") {
			return mysqlLessonResult{}, databaseFoundationFailure("为 orders 增加 PRIMARY KEY，并保留三个核心列")
		}
		if !mysqlColumnHasSequence(stmt, "customer_id", "not", "null") || !mysqlColumnHasSequence(stmt, "amount_cents", "not", "null") {
			return mysqlLessonResult{}, databaseFoundationFailure("customer_id 与 amount_cents 都要声明 NOT NULL")
		}
		if mysqlColumnHasSequence(stmt, "note", "not", "null") {
			return mysqlLessonResult{}, databaseFoundationFailure("note 是可选备注，不要声明 NOT NULL")
		}
		primary := mysqlParenthesizedAfter(stmt, "primary", "key")
		if !hasMySQLWord(primary, "id") && !hasMySQLSequence(stmt, "id", "varchar", "32", "primary", "key") {
			return mysqlLessonResult{}, databaseFoundationFailure("本阶段用 id 作为 PRIMARY KEY")
		}
		output = "Table: orders\nPRIMARY KEY: id\nRequired: customer_id, amount_cents\nOptional: note\n\n表结构已经能阻止缺少顾客或金额的订单进入。"
	default:
		return mysqlLessonResult{}, fmt.Errorf("数据库基础课时 %q 不存在", unitID)
	}

	digest := sha256.Sum256([]byte(unitID + "\x00" + normalized))
	return mysqlLessonResult{
		UnitID: unitID, Command: "database-foundation-verifier " + unitID, Output: output,
		ArtifactDigest: fmt.Sprintf("sha256:%x", digest), VerifierVersion: databaseFoundationVerifierVersion,
	}, nil
}

func databaseFoundationFailure(message string) error {
	return fmt.Errorf("%w：%s", errInvalidDatabaseFoundation, message)
}

func statementContainsString(stmt mysqlStatement, wanted string) bool {
	for _, token := range stmt {
		value := strings.Trim(token.value, "'\"")
		if token.kind == mysqlString && strings.EqualFold(value, wanted) {
			return true
		}
	}
	return false
}

func countMySQLSequence(stmt mysqlStatement, words ...string) int {
	count := 0
	for index := range stmt {
		if hasMySQLSequence(stmt[index:], words...) {
			count++
		}
	}
	return count
}

func mysqlColumnHasSequence(stmt mysqlStatement, column string, words ...string) bool {
	body := mysqlParenthesizedAfter(stmt, "create", "table")
	for start, token := range body {
		if token.kind != mysqlWord || token.value != column {
			continue
		}
		depth := 0
		end := len(body)
		for index := start + 1; index < len(body); index++ {
			switch body[index].value {
			case "(":
				depth++
			case ")":
				depth--
			case ",":
				if depth == 0 {
					end = index
					index = len(body)
				}
			}
		}
		return hasMySQLSequence(body[start:end], words...)
	}
	return false
}
