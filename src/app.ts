import { CosmosClient, ContainerDefinition, DatabaseDefinition, CosmosClientOptions } from "@azure/cosmos";
import { v4 as uuid } from "uuid";
import * as faker from "faker/locale/en_GB";
import Semaphore from "semaphore-async-await";

process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";

const clientOptions: CosmosClientOptions = {
    endpoint: "https://localhost:8081/",
    key: "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
};
const client = new CosmosClient(clientOptions);;

const databaseDefinition: DatabaseDefinition = { id: "test database" };
const partitionKey = "partitionKey";
const collectionDefinition: ContainerDefinition = { id: "test collection", partitionKey: { paths: [`/${partitionKey}`] } };

const createDb = async () => {
    const { database } = await client.databases.createIfNotExists(databaseDefinition);
    const { container } = await database.containers.createIfNotExists(collectionDefinition);
    console.log("DB Created");
}

const populateDb = async () => {
    const numberToCreate = 100000;
    const database = client.database(databaseDefinition.id);
    const container = database.container(collectionDefinition.id);
    const semaphore = new Semaphore(100);
    const promises = new Array(numberToCreate).fill(null).map(async (v, i) => {
        await semaphore.acquire();
        await container.items.create({ partitionKey: uuid(), givenName: faker.name.firstName(), familyName: faker.name.lastName() });
        semaphore.release();
        const count = i + 1;
        if (count % 100 === 0) {
            console.log(`${count} of ${numberToCreate}`);
        }
    });
    await Promise.all(promises);
    console.log("DB Populated");
}

(async () => {
    await createDb();
    await populateDb();
})();
