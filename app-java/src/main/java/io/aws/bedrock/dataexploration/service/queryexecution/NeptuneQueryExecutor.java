// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service.queryexecution;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.aws.bedrock.dataexploration.entity.DatabaseInformation;
import io.aws.bedrock.dataexploration.entity.QueryResult;

import java.util.LinkedList;
import java.util.stream.Collectors;

import org.neo4j.driver.*;
import org.neo4j.driver.Config.TrustStrategy;
import org.neo4j.driver.internal.InternalNode;
import org.neo4j.driver.internal.types.InternalTypeSystem;
import org.neo4j.driver.internal.value.NodeValue;
import org.neo4j.driver.types.Node;
import org.neo4j.driver.types.Type;
import org.neo4j.driver.types.TypeSystem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class NeptuneQueryExecutor implements QueryExecutor {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final Logger LOGGER = LoggerFactory.getLogger(NeptuneQueryExecutor.class);

    private LinkedList<String> recordToValues(org.neo4j.driver.Record record) {
        final LinkedList<String> fieldList = new LinkedList<String>();
        record.fields().forEach(field -> {
            Value value = field.value();
            LOGGER.info("Field: " + value + " - Key: " + field.key());
            if (value.hasType(InternalTypeSystem.TYPE_SYSTEM.NODE())) {
                NodeValue nodeValue = (NodeValue) value;
                try {
                    fieldList.add(objectMapper.writeValueAsString(nodeValue.asMap()));
                } catch (JsonProcessingException e) {
                    LOGGER.error("Error writing value", e);
                    fieldList.add("N/A");
                }
            } else {
                fieldList.add(value.toString());
            }

        });
        return fieldList;
    }

    @Override
    public QueryResult executeQuery(DatabaseInformation databaseInformation, String queryString) {

        // TODO: Check databaseInformation.connectionUrl matches 'bolt://{url}:{port}'
        final Driver driver =
                GraphDatabase.driver(databaseInformation.getConnectionUrl(),
                        AuthTokens.none(),
                        Config.builder().withEncryption().withTrustStrategy(TrustStrategy.trustSystemCertificates()).build());
        final Result rawResult = driver.session().run(queryString);

//        LOGGER.info(rawResult.keys().stream().collect(Collectors.joining(",")));

        // TODO: Check result is finite stream?
        // TODO: Nicer multi-column printing?
        final LinkedList<String> cols = new LinkedList<String>();
        cols.add("Records");


        LinkedList<LinkedList<String>> vals = new LinkedList<>();
        vals.addAll(rawResult.stream().map(this::recordToValues).collect(Collectors.toList()));

        return new QueryResult(vals, cols);
    }
}
